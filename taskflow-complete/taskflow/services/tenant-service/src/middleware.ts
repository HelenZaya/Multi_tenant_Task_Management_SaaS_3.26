import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { UnauthorizedError, getEnv } from "@taskflow/utils";

interface AccessTokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);

  try {
    const env = getEnv();
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: "taskflow",
    }) as AccessTokenPayload;

    request.tenantId = payload.tenantId;
    request.userId = payload.userId;
    request.userRole = payload.role;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Access token expired");
    }
    throw new UnauthorizedError("Invalid access token");
  }
}

/**
 * Require specific roles. Returns a preHandler function.
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.userRole || !roles.includes(request.userRole)) {
      throw new UnauthorizedError(
        `This action requires one of: ${roles.join(", ")}`
      );
    }
  };
}
