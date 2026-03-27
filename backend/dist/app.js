import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { swaggerSpec } from "./config/swagger.js";
import { httpLogger } from "./lib/logger.js";
import { metricsHandler } from "./lib/metrics.js";
import authRoutes from "./routes/authRoutes.js";
import boardRoutes from "./routes/boardRoutes.js";
import cardRoutes from "./routes/cardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import { requestContext } from "./middleware/requestContext.js";
import { errorHandler } from "./middleware/errorHandler.js";
export function createApp() {
    const app = express();
    app.set("trust proxy", 1);
    app.use(httpLogger);
    app.use(requestContext);
    app.use(helmet());
    app.use(cors({
        origin: [env.FRONTEND_ORIGIN, env.GATEWAY_ORIGIN, "https://localhost", "http://localhost:5173"],
        credentials: true
    }));
    app.use(express.json());
    app.use(cookieParser());
    app.use(rateLimit({
        windowMs: 15 * 60 * 1000,
        max: env.RATE_LIMIT_MAX,
        standardHeaders: true,
        legacyHeaders: false
    }));
    app.get("/health", (_req, res) => res.json({ ok: true, service: "backend" }));
    app.get("/ready", (_req, res) => res.json({ ok: true, ready: true }));
    app.get("/metrics", metricsHandler);
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1/workspaces", workspaceRoutes);
    app.use("/api/v1/boards", boardRoutes);
    app.use("/api/v1/cards", cardRoutes);
    app.use("/api/v1/users", userRoutes);
    app.use("/api/v1/reports", reportRoutes);
    app.use(errorHandler);
    return app;
}
