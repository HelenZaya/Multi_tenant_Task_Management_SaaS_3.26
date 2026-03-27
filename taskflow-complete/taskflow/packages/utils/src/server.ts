import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyReply,
} from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import {
  AppError,
  ValidationError,
} from "./errors.js";
import { errorResponse } from "./response.js";
import { createLogger, type Logger } from "./logger.js";
import { randomUUID } from "node:crypto";

export interface ServerOptions {
  serviceName: string;
  port: number;
  logLevel?: string;
  corsOrigin?: string;
}

export async function buildServer(
  opts: ServerOptions
): Promise<{ app: FastifyInstance; logger: Logger }> {
  const logger = createLogger(opts.serviceName, opts.logLevel);

  const app = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
    trustProxy: true,
  });

  // ─── Plugins ──────────────────────────────────────────
  await app.register(cors, {
    origin: opts.corsOrigin ?? "*",
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  // ─── Decorate request with tenant/user fields ─────────
  app.decorateRequest("tenantId", undefined);
  app.decorateRequest("userId", undefined);
  app.decorateRequest("userRole", undefined);
  app.decorateRequest("correlationId", undefined);

  // ─── Request logging + correlation ID ─────────────────
  app.addHook(
    "onRequest",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const correlationId =
        (request.headers["x-correlation-id"] as string) ?? request.id;
      request.correlationId = correlationId;
    }
  );

  app.addHook(
    "onResponse",
    async (request: FastifyRequest, reply: FastifyReply) => {
      logger.info(
        {
          requestId: request.id,
          correlationId: request.correlationId,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: reply.elapsedTime,
          tenantId: request.tenantId,
          userId: request.userId,
        },
        "request completed"
      );
    }
  );

  // ─── Shallow health check (no deps) ──────────────────
  app.get("/health", async () => ({
    status: "ok",
    service: opts.serviceName,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // ─── Metrics stub ─────────────────────────────────────
  app.get("/metrics", async () => ({
    service: opts.serviceName,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    cpuUsage: process.cpuUsage(),
  }));

  // ─── Global error handler ─────────────────────────────
  app.setErrorHandler(
    (
      error: Error & { statusCode?: number },
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      if (error instanceof ValidationError) {
        logger.warn(
          { requestId: request.id, code: error.code, details: error.details },
          error.message
        );
        return reply
          .status(error.statusCode)
          .send(errorResponse(error.code, error.message, error.details));
      }

      if (error instanceof AppError) {
        logger.warn(
          { requestId: request.id, code: error.code },
          error.message
        );
        return reply
          .status(error.statusCode)
          .send(errorResponse(error.code, error.message));
      }

      // Fastify schema validation errors
      if (error.statusCode === 400) {
        logger.warn({ requestId: request.id, err: error }, "Validation error");
        return reply
          .status(400)
          .send(errorResponse("VALIDATION_ERROR", error.message));
      }

      logger.error({ requestId: request.id, err: error }, "Unhandled error");
      return reply
        .status(500)
        .send(errorResponse("INTERNAL_ERROR", "Internal server error"));
    }
  );

  // ─── 404 handler ──────────────────────────────────────
  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .status(404)
      .send(errorResponse("NOT_FOUND", "Route not found"));
  });

  return { app, logger };
}

export async function startServer(
  app: FastifyInstance,
  port: number,
  logger: Logger
): Promise<void> {
  try {
    await app.listen({ port, host: "0.0.0.0" });
    logger.info(`Server listening on port ${port}`);
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}
