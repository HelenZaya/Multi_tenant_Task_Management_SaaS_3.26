import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { createLogger } from "./logger.js";

const logger = createLogger("observability");

/**
 * Register observability hooks on a Fastify instance.
 * Adds:
 *  - x-request-id generation/forwarding
 *  - x-correlation-id propagation
 *  - Request/response timing
 *  - Structured access logging
 */
export function registerObservability(app: FastifyInstance, serviceName: string): void {
  // ─── Request start ────────────────────────────────────
  app.addHook("onRequest", async (request: FastifyRequest, _reply: FastifyReply) => {
    const requestId = (request.headers["x-request-id"] as string) ?? request.id ?? randomUUID();
    const correlationId = (request.headers["x-correlation-id"] as string) ?? requestId;
    const traceId = (request.headers["x-trace-id"] as string) ?? randomUUID();

    request.correlationId = correlationId;

    request._traceId = traceId;
    request._startTime = process.hrtime.bigint();
  });

  // ─── Response complete ────────────────────────────────
  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = request._startTime;
    const durationNs = startTime ? Number(process.hrtime.bigint() - startTime) : 0;
    const durationMs = (durationNs / 1_000_000).toFixed(2);

    logger.info({
      service: serviceName,
      requestId: request.id,
      correlationId: request.correlationId,
      traceId: request._traceId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: parseFloat(durationMs),
      userAgent: request.headers["user-agent"],
      ip: request.ip,
      tenantId: request.tenantId,
      userId: request.userId,
    }, "request");
  });

  // ─── Response headers ─────────────────────────────────
  app.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header("x-request-id", request.id);
    reply.header("x-correlation-id", request.correlationId ?? request.id);
    reply.header("x-response-time", reply.elapsedTime?.toFixed(2) ?? "0");
    reply.header("x-service", serviceName);
  });
}

/**
 * Prometheus-compatible metrics endpoint content.
 */
export function getPrometheusMetrics(serviceName: string): string {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const uptime = process.uptime();

  return [
    `# HELP process_uptime_seconds Process uptime in seconds`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds{service="${serviceName}"} ${uptime.toFixed(2)}`,
    ``,
    `# HELP process_memory_heap_bytes Process heap memory in bytes`,
    `# TYPE process_memory_heap_bytes gauge`,
    `process_memory_heap_bytes{service="${serviceName}"} ${mem.heapUsed}`,
    ``,
    `# HELP process_memory_rss_bytes Process RSS memory in bytes`,
    `# TYPE process_memory_rss_bytes gauge`,
    `process_memory_rss_bytes{service="${serviceName}"} ${mem.rss}`,
    ``,
    `# HELP process_memory_external_bytes Process external memory in bytes`,
    `# TYPE process_memory_external_bytes gauge`,
    `process_memory_external_bytes{service="${serviceName}"} ${mem.external}`,
    ``,
    `# HELP process_cpu_user_microseconds CPU user time in microseconds`,
    `# TYPE process_cpu_user_microseconds gauge`,
    `process_cpu_user_microseconds{service="${serviceName}"} ${cpu.user}`,
    ``,
    `# HELP process_cpu_system_microseconds CPU system time in microseconds`,
    `# TYPE process_cpu_system_microseconds gauge`,
    `process_cpu_system_microseconds{service="${serviceName}"} ${cpu.system}`,
  ].join("\n");
}
