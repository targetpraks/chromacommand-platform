import { db } from "./index";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";

async function runMigrations() {
  console.log("🚀 Running migrations...");
  await migrate(db, { migrationsFolder: path.join(__dirname, "drizzle") });
  console.log("✅ Migrations complete");
  process.exit(0);
}

runMigrations().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
