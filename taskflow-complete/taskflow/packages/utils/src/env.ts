import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  // Postgres
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(20),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),

  // Service ports
  API_GATEWAY_PORT: z.coerce.number().default(3000),
  AUTH_SERVICE_PORT: z.coerce.number().default(3001),
  TENANT_SERVICE_PORT: z.coerce.number().default(3002),
  PROJECT_SERVICE_PORT: z.coerce.number().default(3003),
  TASK_SERVICE_PORT: z.coerce.number().default(3004),
  REALTIME_SERVICE_PORT: z.coerce.number().default(3005),
  NOTIFICATION_SERVICE_PORT: z.coerce.number().default(3006),
  ANALYTICS_SERVICE_PORT: z.coerce.number().default(3007),
  BILLING_SERVICE_PORT: z.coerce.number().default(3008),
  WORKER_SERVICE_PORT: z.coerce.number().default(3009),

  // General
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    const msg = Object.entries(formatted)
      .map(([key, errs]) => `  ${key}: ${(errs ?? []).join(", ")}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${msg}`);
  }

  _env = parsed.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) return loadEnv();
  return _env;
}
