import type { Server, Socket } from "socket.io";
import { createLogger } from "@taskflow/utils";

const logger = createLogger("realtime-service:rooms");

/**
 * Room naming conventions:
 *   - Tenant room:  tenant:<tenantId>
 *   - Project room: project:<projectId>
 *   - User room:    user:<userId>       (for private notifications)
 */

export function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

export function projectRoom(projectId: string): string {
  return `project:${projectId}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Register room management handlers on a socket connection.
 */
export function registerRoomHandlers(_io: Server, socket: Socket): void {
  const user = socket.data.user;
  if (!user) return;

  // Auto-join tenant room and personal room
  const tRoom = tenantRoom(user.tenantId);
  const uRoom = userRoom(user.userId);
  socket.join(tRoom);
  socket.join(uRoom);

  logger.debug(
    { userId: user.userId, rooms: [tRoom, uRoom] },
    "Auto-joined tenant and user rooms"
  );

  // ─── Join project room ────────────────────────────────
  socket.on("join:project", (projectId: string) => {
    if (!projectId || typeof projectId !== "string") return;

    const room = projectRoom(projectId);
    socket.join(room);

    logger.debug(
      { userId: user.userId, projectId, room },
      "Joined project room"
    );

    socket.emit("room:joined", { room, projectId });
  });

  // ─── Leave project room ───────────────────────────────
  socket.on("leave:project", (projectId: string) => {
    if (!projectId || typeof projectId !== "string") return;

    const room = projectRoom(projectId);
    socket.leave(room);

    logger.debug(
      { userId: user.userId, projectId, room },
      "Left project room"
    );

    socket.emit("room:left", { room, projectId });
  });

  // ─── Heartbeat (client pings, server pongs) ──────────
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: Date.now() });
  });

  // ─── Disconnect ───────────────────────────────────────
  socket.on("disconnect", (reason: string) => {
    logger.info(
      { userId: user.userId, reason },
      "Socket disconnected"
    );
  });
}

/**
 * Get connected users count per room.
 */
export async function getRoomStats(io: Server) {
  const rooms = io.sockets.adapter.rooms;
  const stats: Record<string, number> = {};

  for (const [room, sockets] of rooms) {
    // Skip socket-id rooms (each socket auto-joins its own id)
    if (!room.includes(":")) continue;
    stats[room] = sockets.size;
  }

  return stats;
}
