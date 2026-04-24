import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { ledZones, rgbPresets, activityLog, stores } from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";

export const syncRouter = router({
  transform: publicProcedure
    .input(z.object({
      scope: z.enum(["global", "region", "store"]),
      targetId: z.string(),
      presetId: z.string(),
      effectiveAt: z.string(),
      fadeDurationMs: z.number().min(0).max(30000).default(3000),
      components: z.object({
        rgb: z.boolean().default(true),
        content: z.boolean().default(true),
        audio: z.boolean().default(true),
      }),
    }))
    .mutation(async ({ input }) => {
      const [preset] = await db.select().from(rgbPresets).where(eq(rgbPresets.id, input.presetId));
      const colours = (preset?.colours as Record<string, string>) ?? { all: "#1B2A4A" };
      const colourHex = colours.all ?? colours["exterior"] ?? Object.values(colours)[0] ?? "#1B2A4A";

      // Determine affected stores
      let allStores = await db.select().from(stores);
      if (input.scope === "store") {
        allStores = allStores.filter(s => s.id === input.targetId);
      } else if (input.scope === "region") {
        allStores = allStores.filter(s => s.regionId === input.targetId);
      }

      for (const s of allStores) {
        await db.update(ledZones).set({
          currentColour: colourHex,
          currentMode: preset?.mode ?? "solid",
          lastHeartbeat: new Date(),
        }).where(eq(ledZones.storeId, s.id));
      }

      await db.insert(activityLog).values({
        action: "sync_transform",
        scope: input.scope,
        targetId: input.targetId,
        details: {
          presetId: input.presetId,
          components: input.components,
          affectedStores: allStores.length,
        },
      });

      const commandId = `sync_${Date.now()}`;
      return {
        commandId,
        status: "dispatched",
        components: input.components,
        affectedStores: allStores.length,
        estimatedCompleteAt: new Date(Date.now() + input.fadeDurationMs).toISOString(),
      };
    }),
});
