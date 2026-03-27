/**
 * Standalone migration runner.
 * Usage: tsx packages/db/src/run-migrate.ts [migrationsDir]
 *
 * Defaults to services/auth-service/migrations (the canonical migration source).
 */
import { createPool, runMigrations, closePool } from "./index.js";
import { loadEnv, createLogger } from "@taskflow/utils";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = loadEnv();
const logger = createLogger("migrate", env.LOG_LEVEL);

async function main() {
  const migrationsDir =
    process.argv[2] ??
    path.resolve(__dirname, "../../../services/auth-service/migrations");

  logger.info(`Running migrations from: ${migrationsDir}`);

  createPool({
    connectionString: env.DATABASE_URL,
    min: 1,
    max: 3,
  });

  await runMigrations(migrationsDir);
  await closePool();

  logger.info("Migration complete");
}

main().catch((err) => {
  logger.fatal({ err }, "Migration failed");
  process.exit(1);
});
