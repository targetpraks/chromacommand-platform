import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { RgbSetCommand } from "@chromacommand/shared";

export const rgbRouter = router({
  set: publicProcedure
    .input(RgbSetCommand)
    .mutation(async ({ input }) => {
      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return {
        commandId,
        status: "dispatched",
        targets: 1,
        estimatedArrivalMs: 150,
        mqttTopic: `chromacommand/store/${input.targetId}/rgb/set/${input.zone || "all"}`,
      };
    }),

  listPresets: publicProcedure
    .input(z.object({ scope: z.enum(["global", "org"]).default("global") }))
    .query(async () => {
      return [
        { id: "preset_navy_gold", name: "Navy & Gold Native", colours: { all: "#1B2A4A" }, mode: "solid" },
        { id: "preset_mtn_yellow", name: "MTN Yellow", colours: { all: "#FFD100" }, mode: "solid" },
        { id: "preset_fnb_gold", name: "FNB Gold", colours: { all: "#CBA135" }, mode: "pulse" },
      ];
    }),

  getState: publicProcedure
    .input(z.object({ storeId: z.string() }))
    .query(async ({ input }) => {
      return {
        storeId: input.storeId,
        zones: [
          { id: "ceiling", colour: "#1B2A4A", mode: "solid", brightness: 0.85 },
          { id: "window", colour: "#1B2A4A", mode: "solid", brightness: 0.85 },
        ],
      };
    }),
});
