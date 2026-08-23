import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

export * from "./schema";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect().catch((err) => {
  console.error("DB connection failed:", err.message);
});

export const db = drizzle(client, { schema });

/** Close the underlying connection — lets one-shot scripts (seed) exit cleanly. */
export async function closeDatabase(): Promise<void> {
  await client.end();
}
