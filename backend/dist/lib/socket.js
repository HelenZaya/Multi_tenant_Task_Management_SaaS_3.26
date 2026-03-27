import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { redis, redisSubscriber } from "./redis.js";
import { logger } from "./logger.js";
let io = null;
export async function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: [env.FRONTEND_ORIGIN, env.GATEWAY_ORIGIN, "https://localhost"],
            credentials: true
        },
        pingInterval: 15000,
        pingTimeout: 10000
    });
    io.adapter(createAdapter(redis, redisSubscriber));
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) {
                return next(new Error("Missing auth token"));
            }
            const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
            socket.data.userId = payload.sub;
            socket.data.tenantId = payload.tenantId;
            socket.data.role = payload.role;
            return next();
        }
        catch (error) {
            return next(error);
        }
    });
    io.on("connection", (socket) => {
        socket.join(`tenant:${socket.data.tenantId}`);
        socket.emit("socket.ready", { ok: true, userId: socket.data.userId });
        socket.on("heartbeat", () => socket.emit("heartbeat", { ts: Date.now() }));
        socket.on("disconnect", () => {
            logger.info({ userId: socket.data.userId }, "socket disconnected");
        });
    });
}
export function broadcastTenantEvent(tenantId, event, payload) {
    io?.to(`tenant:${tenantId}`).emit(event, payload);
}
