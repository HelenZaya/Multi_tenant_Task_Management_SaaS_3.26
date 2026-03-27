import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8080);
const backendUrl = process.env.BACKEND_URL || "http://backend:4000";

app.set("trust proxy", 1);
app.use(helmet());
app.use(morgan("combined"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.RATE_LIMIT_MAX || 500) }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "gateway" }));

const backendProxy = createProxyMiddleware({
  target: backendUrl,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  onProxyReq: (proxyReq, req) => {
    if (req.headers["x-request-id"]) {
      proxyReq.setHeader("x-request-id", req.headers["x-request-id"]);
    }
  }
});

app.use((req, res, next) => {
  if (["/api", "/docs", "/metrics", "/ready", "/socket.io"].some((prefix) => req.path.startsWith(prefix))) {
    return backendProxy(req, res, next);
  }
  next();
});

app.listen(port, () => {
  console.log(`gateway listening on ${port}`);
});
