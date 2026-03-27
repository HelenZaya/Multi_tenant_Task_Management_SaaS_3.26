import http from "http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { initSocket } from "./socket.js";

const app = createApp();
const server = http.createServer(app);

await initSocket(server);

server.listen(env.port, () => {
  logger.info(`API listening on http://0.0.0.0:${env.port}`);
});
