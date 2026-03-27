import type { IncomingMessage } from "http";
import pino from "pino";
import pinoHttpModule from "pino-http";

const pinoHttp = pinoHttpModule as unknown as (options: Record<string, unknown>) => (req: IncomingMessage, res: unknown, next?: () => void) => void;

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug"
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: { headers: Record<string, unknown> }) => (req.headers["x-request-id"] as string | undefined) ?? crypto.randomUUID(),
  customSuccessMessage: () => "request completed",
  customErrorMessage: () => "request errored"
});
