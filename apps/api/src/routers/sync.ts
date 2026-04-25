import { router, requireScope } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { ledZones, rgbPresets, activityLog, stores } from "@chromacommand/database/schema";
import { eq } from "drizzle-orm";
import { publishCommand } from "../mqtt";
import { broadcast } from "../live";
import { scopeFromRequest } from "../scope";

const transformInput = z.object({
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
});

export const syncRouter = router({
  transform: requireScope<z.infer<typeof transformInput>>((i) => scopeFromRequest(i))
    .input(transformInput)
    .mutation(async ({ input, ctx }) => {
      const [preset] = await db.select().from(rgbPresets).where(eq(rgbPresets.id, input.presetId));
      const colours = (preset?.colours as Record<string, string>) ?? { all: "#1B2A4A" };
      const colourHex = colours.all ?? colours["exterior"] ?? Object.values(colours)[0] ?? "#1B2A4A";

      let allStores = await db.select().from(stores);
      if (input.scope === "store") {
        allStores = allStores.filter((s) => s.id === input.targetId);
      } else if (input.scope === "region") {
        allStores = allStores.filter((s) => s.regionId === input.targetId);
      }

      const commandId = `sync_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      for (const s of allStores) {
        if (input.components.rgb) {
          await db
            .update(ledZones)
            .set({
              currentColour: colourHex,
              currentMode: preset?.mode ?? "solid",
              lastHeartbeat: new Date(),
            })
            .where(eq(ledZones.storeId, s.id));

          await publishCommand(
            `chromacommand/store/${s.id}/rgb/set/all`,
            { command_id: commandId, colour: colourHex, mode: preset?.mode ?? "solid", fade_ms: input.fadeDurationMs, ts: Date.now() },
            1
          );
        }
        if (input.components.content) {
          await publishCommand(
            `chromacommand/store/${s.id}/content/playlist`,
            { command_id: commandId, preset_id: input.presetId, crossfade: true, ts: Date.now() },
            1
          );
        }
        if (input.components.audio) {
          await publishCommand(
            `chromacommand/store/${s.id}/audio/playlist`,
            { command_id: commandId, preset_id: input.presetId, fade_ms: input.fadeDurationMs, ts: Date.now() },
            1
          );
        }

        broadcast({
          type: "sync_complete",
          storeId: s.id,
          payload: { presetId: input.presetId, components: input.components, colour: colourHex },
        });
      }

      await db.insert(activityLog).values({
        userId: (ctx.user as any)?.id ?? null,
        action: "sync_transform",
        scope: input.scope,
        targetId: input.targetId,
        details: {
          presetId: input.presetId,
          components: input.components,
          affectedStores: allStores.length,
          commandId,
        },
      });

      return {
        commandId,
        status: "dispatched",
        components: input.components,
        affectedStores: allStores.length,
        estimatedCompleteAt: new Date(Date.now() + input.fadeDurationMs).toISOString(),
      };
    }),
});
