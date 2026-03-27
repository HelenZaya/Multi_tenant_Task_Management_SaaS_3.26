import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { httpRequestDuration } from "../lib/metrics.js";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  req.requestId = (req.headers["x-request-id"] as string | undefined) ?? uuidv4();
  res.setHeader("x-request-id", req.requestId);
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({
      method: req.method,
      route: req.route?.path ?? req.path,
      status_code: res.statusCode
    });
  });
  next();
}
