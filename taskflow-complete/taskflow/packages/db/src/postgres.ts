import pg from "pg";
import { createLogger } from "@taskflow/utils";

const logger = createLogger("db:postgres");

let pool: pg.Pool | null = null;

export interface PoolConfig {
  connectionString: string;
  min?: number;
  max?: number;
}

export function createPool(config: PoolConfig): pg.Pool {
  if (pool) return pool;

  pool = new pg.Pool({
    connectionString: config.connectionString,
    min: config.min ?? 2,
    max: config.max ?? 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });

  pool.on("connect", () => {
    logger.debug("New PG client connected");
  });

  pool.on("error", (err) => {
    logger.error({ err }, "Unexpected PG pool error");
  });

  logger.info("PostgreSQL pool created");
  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error("PostgreSQL pool not initialized. Call createPool() first.");
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info("PostgreSQL pool closed");
  }
}

/**
 * Execute a query with tenant isolation via RLS.
 * Sets `app.tenant_id` on the connection before running the query.
 */
export async function queryWithTenant<T extends pg.QueryResultRow = pg.QueryResultRow>(
  tenantId: string,
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const client = await getPool().connect();
  try {
    // SET LOCAL scopes to the current transaction
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const result = await client.query<T>(text, params);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute a query WITHOUT tenant context (for auth, system-level ops).
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * Execute multiple queries in a transaction with tenant context.
 */
export async function transactionWithTenant<T>(
  tenantId: string,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction WITHOUT tenant context.
 */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
