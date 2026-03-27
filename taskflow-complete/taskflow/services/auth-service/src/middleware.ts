import type { FastifyRequest, FastifyReply } from "fastify";
import { UnauthorizedError } from "@taskflow/utils";
import { verifyAccessToken } from "./tokens.js";

/**
 * Middleware: Verify JWT access token and set user context on request.
 * Use as a preHandler on protected routes.
 */
export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  request.tenantId = payload.tenantId;
  request.userId = payload.userId;
  request.userRole = payload.role;
}
