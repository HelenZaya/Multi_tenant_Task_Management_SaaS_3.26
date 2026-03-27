import { loadEnv, createLogger, buildServer, startServer } from "@taskflow/utils";
import {
  createPool,
  createRedis,
  closePool,
  closeRedis,
  checkHealth,
} from "@taskflow/db";
import { scheduleJob, startScheduler, stopScheduler } from "./scheduler.js";
import { startJobListener } from "./listener.js";
import { refreshAllAnalytics } from "./jobs/analytics.js";
import {
  processNotificationEmails,
  cleanupOldNotifications,
} from "./jobs/notifications.js";

const env = loadEnv();
const logger = createLogger("worker-service", env.LOG_LEVEL);

async function main() {
  // ─── Infrastructure ───────────────────────────────────
  createPool({
    connectionString: env.DATABASE_URL,
    min: env.DATABASE_POOL_MIN,
    max: env.DATABASE_POOL_MAX,
  });
  createRedis(env.REDIS_URL);

  // ─── HTTP server for health checks ────────────────────
  const { app } = await buildServer({
    serviceName: "worker-service",
    port: env.WORKER_SERVICE_PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigin: env.CORS_ORIGIN,
  });

  app.get("/health/deep", async (_req, reply) => {
    const health = await checkHealth();
    return reply.status(health.healthy ? 200 : 503).send({
      status: health.healthy ? "ok" : "degraded",
      service: "worker-service",
      timestamp: new Date().toISOString(),
      dependencies: health,
    });
  });

  await startServer(app, env.WORKER_SERVICE_PORT, logger);

  // ─── Schedule periodic jobs ───────────────────────────
  // Analytics refresh: every 5 minutes
  scheduleJob("analytics-refresh", 5 * 60 * 1000, refreshAllAnalytics);

  // Notification emails: every 1 minute
  scheduleJob("notification-emails", 60 * 1000, processNotificationEmails);

  // Notification cleanup: every 24 hours
  scheduleJob("notification-cleanup", 24 * 60 * 60 * 1000, cleanupOldNotifications);

  startScheduler();

  // ─── Start on-demand job listener ─────────────────────
  await startJobListener(env.REDIS_URL);

  // ─── Graceful shutdown ────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    stopScheduler();
    await app.close();
    await closePool();
    await closeRedis();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start worker-service");
  process.exit(1);
});
