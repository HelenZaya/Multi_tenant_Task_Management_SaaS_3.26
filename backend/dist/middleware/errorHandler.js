import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
export function errorHandler(error, req, res, _next) {
    if (error instanceof ZodError) {
        return res.status(400).json({
            requestId: req.requestId,
            message: "Validation failed",
            issues: error.flatten()
        });
    }
    const err = error;
    const status = err.status ?? 500;
    logger.error({ err: error, requestId: req.requestId }, "request failed");
    res.status(status).json({
        requestId: req.requestId,
        message: err.message ?? "Internal server error"
    });
}
