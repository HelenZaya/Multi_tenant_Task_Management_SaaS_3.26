import pino from "pino";

export function createLogger(serviceName: string, level?: string) {
  return pino({
    name: serviceName,
    level: level ?? process.env["LOG_LEVEL"] ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label: string) {
        return { level: label };
      },
      bindings(bindings: pino.Bindings) {
        return {
          service: bindings["name"],
          pid: bindings["pid"],
          hostname: bindings["hostname"],
        };
      },
    },
    ...(process.env["NODE_ENV"] === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss.l",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
  });
}

export type Logger = pino.Logger;
