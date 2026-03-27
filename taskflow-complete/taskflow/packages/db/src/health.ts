import { getPool } from "./postgres.js";
import { getRedis } from "./redis.js";
import { createLogger } from "@taskflow/utils";

const logger = createLogger("db:health");

export interface HealthStatus {
  postgres: { connected: boolean; latencyMs: number; poolTotal: number; poolIdle: number; poolWaiting: number };
  redis: { connected: boolean; latencyMs: number };
  healthy: boolean;
}

export async function checkHealth(): Promise<HealthStatus> {
  const status: HealthStatus = {
    postgres: { connected: false, latencyMs: -1, poolTotal: 0, poolIdle: 0, poolWaiting: 0 },
    redis: { connected: false, latencyMs: -1 },
    healthy: false,
  };

  // Check Postgres
  try {
    const pool = getPool();
    const start = Date.now();
    await pool.query("SELECT 1");
    status.postgres = {
      connected: true,
      latencyMs: Date.now() - start,
      poolTotal: pool.totalCount,
      poolIdle: pool.idleCount,
      poolWaiting: pool.waitingCount,
    };
  } catch (err) {
    logger.error({ err }, "Postgres health check failed");
  }

  // Check Redis
  try {
    const redis = getRedis();
    const start = Date.now();
    await redis.ping();
    status.redis = {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    logger.error({ err }, "Redis health check failed");
  }

  status.healthy = status.postgres.connected && status.redis.connected;
  return status;
}
