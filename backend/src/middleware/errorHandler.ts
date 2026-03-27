import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      requestId: req.requestId,
      message: "Validation failed",
      issues: error.flatten()
    });
  }

  const err = error as { status?: number; message?: string };
  const status = err.status ?? 500;
  logger.error({ err: error, requestId: req.requestId }, "request failed");
  res.status(status).json({
    requestId: req.requestId,
    message: err.message ?? "Internal server error"
  });
}
