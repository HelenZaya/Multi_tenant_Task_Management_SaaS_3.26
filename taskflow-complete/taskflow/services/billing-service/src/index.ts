import { loadEnv, createLogger, buildServer, startServer } from "@taskflow/utils";
import {
  createPool,
  createRedis,
  closePool,
  closeRedis,
  checkHealth,
  registerTenantContext,
  runMigrations,
} from "@taskflow/db";
import { billingRoutes } from "./routes.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = loadEnv();
const logger = createLogger("billing-service", env.LOG_LEVEL);

async function main() {
  createPool({
    connectionString: env.DATABASE_URL,
    min: env.DATABASE_POOL_MIN,
    max: env.DATABASE_POOL_MAX,
  });
  createRedis(env.REDIS_URL);
  await runMigrations(path.resolve(__dirname, "../migrations"));

  const { app } = await buildServer({
    serviceName: "billing-service",
    port: env.BILLING_SERVICE_PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigin: env.CORS_ORIGIN,
  });

  registerTenantContext(app);
  await app.register(billingRoutes, { prefix: "/billing" });

  app.get("/health/deep", async (_req, reply) => {
    const health = await checkHealth();
    return reply.status(health.healthy ? 200 : 503).send({
      status: health.healthy ? "ok" : "degraded",
      service: "billing-service",
      timestamp: new Date().toISOString(),
      dependencies: health,
    });
  });

  await startServer(app, env.BILLING_SERVICE_PORT, logger);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    await app.close();
    await closePool();
    await closeRedis();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start billing-service");
  process.exit(1);
});
