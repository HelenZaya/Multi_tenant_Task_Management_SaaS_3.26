import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { httpLogger } from "./lib/logger.js";
import { metricsHandler, httpRequestDuration } from "./lib/metrics.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import boardRoutes from "./routes/boardRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import cardRoutes from "./routes/cardRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({
    origin: [env.frontendOrigin, "http://localhost:5173", "https://localhost"],
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan("dev"));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

  app.use((req, res, next) => {
    const end = httpRequestDuration.startTimer();
    res.on("finish", () => end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode }));
    next();
  });

  app.get("/health", (req, res) => res.json({ ok: true, service: "backend" }));
  app.get("/ready", (req, res) => res.json({ ok: true, ready: true }));
  app.get("/metrics", metricsHandler);

  app.use("/auth", authRoutes);
  app.use("/dashboard", dashboardRoutes);
  app.use("/boards", boardRoutes);
  app.use("/users", userRoutes);
  app.use("/cards", cardRoutes);

  app.use(errorHandler);
  return app;
}
