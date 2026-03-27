import http from "http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { initializeSocket } from "./lib/socket.js";

const app = createApp();
const server = http.createServer(app);

await initializeSocket(server);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "backend listening");
});
