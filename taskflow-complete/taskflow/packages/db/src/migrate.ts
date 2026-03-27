import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "./postgres.js";
import { createLogger } from "@taskflow/utils";

const logger = createLogger("db:migrate");

/**
 * Simple migration runner.
 * Reads .sql files from a directory, executes them in alphabetical order.
 * Tracks applied migrations in a `_migrations` table.
 */
export async function runMigrations(migrationsDir: string): Promise<void> {
  const pool = getPool();

  // Ensure migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Get already applied migrations
  const { rows: applied } = await pool.query<{ name: string }>(
    "SELECT name FROM _migrations ORDER BY name"
  );
  const appliedSet = new Set(applied.map((r) => r.name));

  // Read migration files
  let files: string[];
  try {
    files = await readdir(migrationsDir);
  } catch {
    logger.warn(`Migrations directory not found: ${migrationsDir}`);
    return;
  }

  const sqlFiles = files
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (appliedSet.size === 0 && sqlFiles.length > 0) {
    const { rows: existingSchema } = await pool.query<{ relation: string | null }>(
      `SELECT to_regclass('public.tenants') AS relation`
    );

    if (existingSchema[0]?.relation) {
      await pool.query(
        `INSERT INTO _migrations (name)
         SELECT UNNEST($1::text[])
         ON CONFLICT (name) DO NOTHING`,
        [sqlFiles]
      );
      logger.info(
        { migrationsDir, count: sqlFiles.length },
        "Existing schema detected; marked migrations as applied"
      );
      return;
    }
  }

  let count = 0;
  for (const file of sqlFiles) {
    if (appliedSet.has(file)) {
      logger.debug(`Migration already applied: ${file}`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = await readFile(filePath, "utf-8");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO _migrations (name) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");
      logger.info(`Applied migration: ${file}`);
      count++;
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error({ err, file }, `Failed to apply migration: ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  if (count === 0) {
    logger.info("No new migrations to apply");
  } else {
    logger.info(`Applied ${count} migration(s)`);
  }
}
