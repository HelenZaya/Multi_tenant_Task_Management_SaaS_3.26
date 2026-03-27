import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { TenantIsolationError } from "@taskflow/utils";

/**
 * Extends FastifyRequest with tenant + user context.
 * After auth middleware runs, these are guaranteed to exist on protected routes.
 */
declare module "fastify" {
  interface FastifyRequest {
    tenantId?: string;
    userId?: string;
    userRole?: string;
    correlationId?: string;
  }
}

/**
 * Middleware: Extract tenant context from request.
 *
 * Tenant ID comes from (in priority order):
 *   1. JWT payload (set by auth middleware)
 *   2. x-tenant-id header (set by API gateway after JWT validation)
 *
 * This middleware MUST run after auth middleware on protected routes.
 */
export async function tenantContextMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // If already set by auth middleware (JWT decode), use that
  if (request.tenantId) return;

  // Fallback: gateway-injected header
  const headerTenantId = request.headers["x-tenant-id"] as string | undefined;
  if (headerTenantId) {
    request.tenantId = headerTenantId;
    return;
  }
}

/**
 * Middleware: REQUIRE tenant context — throws if missing.
 * Use on all tenant-scoped routes.
 */
export async function requireTenantContext(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (!request.tenantId) {
    throw new TenantIsolationError();
  }
}

/**
 * Register tenant context hooks on a Fastify instance.
 * Adds tenantId extraction to every request.
 */
export function registerTenantContext(app: FastifyInstance): void {
  app.addHook("onRequest", tenantContextMiddleware);
}
