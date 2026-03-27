import { loadEnv, createLogger, buildServer, startServer } from "@taskflow/utils";
import {
  createPool,
  createRedis,
  closePool,
  closeRedis,
  checkHealth,
} from "@taskflow/db";
import { gatewayAuthMiddleware } from "./auth.js";
import { registerRateLimit } from "./rate-limit.js";
import { registerProxyRoutes } from "./proxy.js";

const env = loadEnv();
const logger = createLogger("api-gateway", env.LOG_LEVEL);

async function main() {
  // Infrastructure (Redis for rate limiting)
  createPool({
    connectionString: env.DATABASE_URL,
    min: 1,
    max: 5,
  });
  createRedis(env.REDIS_URL);

  const { app } = await buildServer({
    serviceName: "api-gateway",
    port: env.API_GATEWAY_PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigin: env.CORS_ORIGIN,
  });

  // ─── Rate limiting (before auth) ─────────────────────
  await registerRateLimit(app);

  // ─── Gateway-level JWT decode (non-blocking) ─────────
  app.addHook("onRequest", gatewayAuthMiddleware);

  // ─── Proxy routes to downstream services ─────────────
  await registerProxyRoutes(app);

  // ─── Gateway health (aggregated) ─────────────────────
  app.get("/health/deep", async (_req, reply) => {
    const health = await checkHealth();
    return reply.status(health.healthy ? 200 : 503).send({
      status: health.healthy ? "ok" : "degraded",
      service: "api-gateway",
      timestamp: new Date().toISOString(),
      dependencies: health,
    });
  });

  // ─── Gateway info ────────────────────────────────────
  app.get("/", async () => ({
    service: "taskflow-api-gateway",
    version: "1.0.0",
    routes: [
      "POST /auth/register-tenant",
      "POST /auth/login",
      "POST /auth/refresh",
      "GET  /auth/me",
      "GET  /tenants/current",
      "GET  /tenants/members",
      "POST /tenants/members/invite",
      "GET  /projects",
      "POST /projects",
      "GET  /projects/:id",
      "GET  /projects/:id/boards",
      "GET  /tasks?projectId=",
      "POST /tasks",
      "POST /tasks/:id/move",
      "GET  /tasks/:id/comments",
      "GET  /notifications",
      "GET  /analytics/dashboard",
      "GET  /billing/overview",
    ],
  }));

  await startServer(app, env.API_GATEWAY_PORT, logger);

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
  logger.fatal({ err }, "Failed to start api-gateway");
  process.exit(1);
});
