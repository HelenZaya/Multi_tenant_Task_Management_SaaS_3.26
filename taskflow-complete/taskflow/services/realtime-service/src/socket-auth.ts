import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { getEnv, createLogger } from "@taskflow/utils";

const logger = createLogger("realtime-service:auth");

export interface SocketUser {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

/**
 * Socket.IO middleware: verify JWT token from handshake auth.
 * Client connects with: io(url, { auth: { token: "Bearer <jwt>" } })
 */
export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): void {
  try {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    // Strip "Bearer " prefix if present
    const rawToken = token.startsWith("Bearer ") ? token.slice(7) : token;

    const env = getEnv();
    const payload = jwt.verify(rawToken, env.JWT_SECRET, {
      issuer: "taskflow",
    }) as SocketUser;

    // Attach user data to socket
    socket.data.user = payload;
    socket.data.tenantId = payload.tenantId;
    socket.data.userId = payload.userId;

    logger.debug(
      { userId: payload.userId, tenantId: payload.tenantId },
      "Socket authenticated"
    );

    next();
  } catch (err) {
    logger.warn({ err }, "Socket authentication failed");
    next(new Error("Invalid or expired token"));
  }
}
