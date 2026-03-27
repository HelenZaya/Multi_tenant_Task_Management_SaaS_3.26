import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import {
  loadEnv,
  createLogger,
} from "@taskflow/utils";
import {
  createPool,
  createRedis,
  getRedisPublisher,
  getRedisSubscriber,
  closePool,
  closeRedis,
  checkHealth,
} from "@taskflow/db";
import { socketAuthMiddleware } from "./socket-auth.js";
import { registerRoomHandlers, getRoomStats } from "./rooms.js";
import { startEventBridge } from "./event-bridge.js";

const env = loadEnv();
const logger = createLogger("realtime-service", env.LOG_LEVEL);

async function main() {
  // ─── Infrastructure ───────────────────────────────────
  createPool({
    connectionString: env.DATABASE_URL,
    min: env.DATABASE_POOL_MIN,
    max: env.DATABASE_POOL_MAX,
  });
  createRedis(env.REDIS_URL);

  // ─── HTTP server (for health checks + Socket.IO upgrade) ─
  const httpServer = createServer(async (req, res) => {
    // Health endpoint
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          service: "realtime-service",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        })
      );
      return;
    }

    // Deep health
    if (req.url === "/health/deep" && req.method === "GET") {
      const health = await checkHealth();
      const status = health.healthy ? 200 : 503;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: health.healthy ? "ok" : "degraded",
          service: "realtime-service",
          timestamp: new Date().toISOString(),
          dependencies: health,
          sockets: {
            connected: io.engine.clientsCount,
          },
        })
      );
      return;
    }

    // Metrics
    if (req.url === "/metrics" && req.method === "GET") {
      const roomStats = await getRoomStats(io);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          service: "realtime-service",
          connectedClients: io.engine.clientsCount,
          rooms: roomStats,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
        })
      );
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  // ─── Socket.IO server ────────────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
    pingInterval: 25000,    // heartbeat interval (25s)
    pingTimeout: 20000,     // disconnect if no pong within 20s
    transports: ["websocket", "polling"],
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,  // 2 minutes
      skipMiddlewares: true,
    },
  });

  // ─── Redis adapter (horizontal scaling) ───────────────
  const pubClient = getRedisPublisher(env.REDIS_URL);
  const subClient = getRedisSubscriber(env.REDIS_URL);
  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Socket.IO Redis adapter configured");

  // ─── Authentication middleware ────────────────────────
  io.use(socketAuthMiddleware);

  // ─── Connection handler ───────────────────────────────
  io.on("connection", (socket) => {
    const user = socket.data.user;
    logger.info(
      {
        userId: user?.userId,
        tenantId: user?.tenantId,
        socketId: socket.id,
        transport: socket.conn.transport.name,
      },
      "Client connected"
    );

    // Register room management + heartbeat handlers
    registerRoomHandlers(io, socket);

    // Send connection confirmation
    socket.emit("connected", {
      socketId: socket.id,
      userId: user?.userId,
      tenantId: user?.tenantId,
      timestamp: Date.now(),
    });

    // Handle errors
    socket.on("error", (err) => {
      logger.error(
        { err, socketId: socket.id, userId: user?.userId },
        "Socket error"
      );
    });
  });

  // ─── Event bridge (Redis pub/sub → Socket.IO rooms) ──
  await startEventBridge(io, env.REDIS_URL);

  // ─── Start server ────────────────────────────────────
  const port = env.REALTIME_SERVICE_PORT;
  httpServer.listen(port, "0.0.0.0", () => {
    logger.info(`Realtime service listening on port ${port}`);
  });

  // ─── Periodic stats logging ──────────────────────────
  setInterval(async () => {
    const roomStats = await getRoomStats(io);
    const roomCount = Object.keys(roomStats).length;
    logger.info(
      {
        connectedClients: io.engine.clientsCount,
        rooms: roomCount,
      },
      "Realtime stats"
    );
  }, 60_000); // every 60 seconds

  // ─── Graceful shutdown ────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);

    // Notify all clients
    io.emit("server:shutdown", { message: "Server is restarting" });

    // Close Socket.IO
    io.close();

    // Close HTTP server
    httpServer.close();

    // Close infrastructure
    await closePool();
    await closeRedis();

    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start realtime-service");
  process.exit(1);
});
