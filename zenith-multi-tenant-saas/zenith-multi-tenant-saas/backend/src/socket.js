import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

let io;

export async function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [env.frontendOrigin, "https://localhost", "http://localhost:5173"],
      credentials: true,
    },
  });

  const pubClient = new Redis(env.redisUrl);
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Missing auth token"));
      const decoded = jwt.verify(token, env.jwtAccessSecret);
      socket.data.userId = decoded.sub;
      socket.data.organizationId = decoded.organizationId;
      return next();
    } catch {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`org:${socket.data.organizationId}`);
    socket.emit("socket.ready", { ok: true });

    socket.on("heartbeat", () => {
      socket.emit("heartbeat", { ts: Date.now() });
    });

    socket.on("disconnect", () => {
      logger.info({ userId: socket.data.userId }, "socket disconnected");
    });
  });

  return io;
}

export function emitBoardUpdated(organizationId, boardId) {
  io?.to(`org:${organizationId}`).emit("board.updated", { organizationId, boardId });
}
