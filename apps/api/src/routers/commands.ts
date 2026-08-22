import { router, protectedProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@chromacommand/database";
import { commands } from "@chromacommand/database/schema";
import { eq, desc, and, or, type SQL } from "drizzle-orm";

/**
 * Command ledger — observability for every dispatched control command.
 * ack_state is filled by the MQTT ack path in mqtt.ts as devices confirm.
 */
export const commandsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        targetId: z.string().optional(),
        status: z.enum(["dispatched", "partial", "complete", "failed"]).optional(),
        kind: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const conditions: SQL<unknown>[] = [];
      if (input.targetId) {
        conditions.push(or(eq(commands.targetId, input.targetId), eq(commands.scope, "global"))!);
      }
      if (input.status) conditions.push(eq(commands.status, input.status));
      if (input.kind) conditions.push(eq(commands.kind, input.kind));

      const base = db.select().from(commands);
      const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;
      return filtered.orderBy(desc(commands.createdAt)).limit(input.limit);
    }),

  get: protectedProcedure
    .input(z.object({ commandId: z.string() }))
    .query(async ({ input }) => {
      const [row] = await db.select().from(commands).where(eq(commands.commandId, input.commandId)).limit(1);
      if (!row) throw new Error("Command not found");
      return row;
    }),
});
