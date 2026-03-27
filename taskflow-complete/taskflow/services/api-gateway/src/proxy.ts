import proxy from "@fastify/http-proxy";
import type { FastifyInstance } from "fastify";
import type { IncomingHttpHeaders } from "node:http";
import { getEnv, createLogger } from "@taskflow/utils";

const logger = createLogger("api-gateway:proxy");

interface ServiceRoute {
  prefix: string;
  upstream: string;
}

function getServiceRoutes(): ServiceRoute[] {
  const env = getEnv();
  const useDockerHost = process.env["DOCKER_ENV"] === "true";
  const resolveServiceUrl = (serviceName: string, port: number) =>
    useDockerHost
      ? `http://${serviceName}:${port}`
      : `http://localhost:${port}`;

  return [
    {
      prefix: "/auth",
      upstream: resolveServiceUrl("auth-service", env.AUTH_SERVICE_PORT),
    },
    {
      prefix: "/tenants",
      upstream: resolveServiceUrl("tenant-service", env.TENANT_SERVICE_PORT),
    },
    {
      prefix: "/projects",
      upstream: resolveServiceUrl("project-service", env.PROJECT_SERVICE_PORT),
    },
    {
      prefix: "/boards",
      upstream: resolveServiceUrl("task-service", env.TASK_SERVICE_PORT),
    },
    {
      prefix: "/columns",
      upstream: resolveServiceUrl("task-service", env.TASK_SERVICE_PORT),
    },
    {
      prefix: "/tasks",
      upstream: resolveServiceUrl("task-service", env.TASK_SERVICE_PORT),
    },
    {
      prefix: "/comments",
      upstream: resolveServiceUrl("task-service", env.TASK_SERVICE_PORT),
    },
    {
      prefix: "/attachments",
      upstream: resolveServiceUrl("task-service", env.TASK_SERVICE_PORT),
    },
    {
      prefix: "/notifications",
      upstream: resolveServiceUrl(
        "notification-service",
        env.NOTIFICATION_SERVICE_PORT
      ),
    },
    {
      prefix: "/analytics",
      upstream: resolveServiceUrl(
        "analytics-service",
        env.ANALYTICS_SERVICE_PORT
      ),
    },
    {
      prefix: "/billing",
      upstream: resolveServiceUrl("billing-service", env.BILLING_SERVICE_PORT),
    },
  ];
}

export async function registerProxyRoutes(app: FastifyInstance): Promise<void> {
  const routes = getServiceRoutes();

  for (const route of routes) {
    await app.register(proxy as never, {
      upstream: route.upstream,
      prefix: route.prefix,
      rewritePrefix: route.prefix,
      http2: false,

      replyOptions: {
        rewriteRequestHeaders: (
          originalReq: {
            id: string;
            ip: string;
            tenantId?: string;
            userId?: string;
            userRole?: string;
            correlationId?: string;
          },
          headers: IncomingHttpHeaders
        ) => {
          const nextHeaders: IncomingHttpHeaders = { ...headers };

          // Inject gateway context headers for downstream
          if (originalReq.tenantId) {
            nextHeaders["x-tenant-id"] = originalReq.tenantId;
          }
          if (originalReq.userId) {
            nextHeaders["x-user-id"] = originalReq.userId;
          }
          if (originalReq.userRole) {
            nextHeaders["x-user-role"] = originalReq.userRole;
          }
          if (originalReq.correlationId) {
            nextHeaders["x-correlation-id"] = originalReq.correlationId;
          }
          nextHeaders["x-request-id"] = originalReq.id;
          nextHeaders["x-forwarded-for"] = originalReq.ip;

          return nextHeaders;
        },
      },
    } as never);

    logger.info({ prefix: route.prefix, upstream: route.upstream }, "Proxy route registered");
  }
}
