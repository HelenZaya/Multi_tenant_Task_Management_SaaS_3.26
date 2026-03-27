import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { getEnv, createLogger } from "@taskflow/utils";

const logger = createLogger("api-gateway:auth");

interface AccessTokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

/**
 * Gateway-level JWT validation.
 * Decodes the token and injects x-user-id, x-tenant-id, x-user-role headers
 * for downstream services.
 *
 * Does NOT block if no token — some routes are public (e.g. /auth/login).
 * Individual services enforce auth on their own routes.
 */
export async function gatewayAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return; // Let the downstream service decide
  }

  try {
    const token = authHeader.slice(7);
    const env = getEnv();
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: "taskflow",
    }) as AccessTokenPayload;

    // Inject into request for proxy headers
    request.tenantId = payload.tenantId;
    request.userId = payload.userId;
    request.userRole = payload.role;
  } catch (err) {
    // Don't block — let downstream handle expired/invalid tokens
    logger.debug({ err }, "Gateway JWT decode failed (non-blocking)");
  }
}
