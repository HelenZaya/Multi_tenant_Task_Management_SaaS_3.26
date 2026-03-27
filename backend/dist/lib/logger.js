import pino from "pino";
import pinoHttpModule from "pino-http";
const pinoHttp = pinoHttpModule;
export const logger = pino({
    level: process.env.NODE_ENV === "production" ? "info" : "debug"
});
export const httpLogger = pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] ?? crypto.randomUUID(),
    customSuccessMessage: () => "request completed",
    customErrorMessage: () => "request errored"
});
