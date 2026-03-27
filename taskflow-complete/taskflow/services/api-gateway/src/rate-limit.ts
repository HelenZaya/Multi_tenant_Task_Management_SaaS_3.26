import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { getRedis } from "@taskflow/db";
import { createLogger, RateLimitError } from "@taskflow/utils";

const logger = createLogger("api-gateway:rate-limit");

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: 100,               // 100 requests per window
    timeWindow: "1 minute",
    ban: 5,                 // ban after 5 consecutive limit hits

    // Use Redis for distributed rate limiting
    redis: getRedis(),

    // Key by IP + tenant
    keyGenerator: (request) => {
      const tenantId = request.tenantId ?? "anonymous";
      const ip = request.ip;
      return `rl:${tenantId}:${ip}`;
    },

    // Custom error handler
    errorResponseBuilder: (_request, context) => {
      throw new RateLimitError(
        `Rate limit exceeded. Max ${context.max} requests per ${context.after}. Retry after ${context.after}.`
      );
    },

    // Skip health checks
    allowList: (request) => {
      return request.url === "/health" || request.url === "/metrics";
    },
  });

  logger.info("Rate limiting registered");
}
