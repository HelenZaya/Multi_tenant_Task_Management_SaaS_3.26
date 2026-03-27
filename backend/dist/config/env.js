import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    FRONTEND_ORIGIN: z.string().default("https://localhost"),
    GATEWAY_ORIGIN: z.string().default("https://localhost"),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    ACCESS_TOKEN_TTL: z.string().default("15m"),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
    BCRYPT_ROUNDS: z.coerce.number().default(12),
    RATE_LIMIT_MAX: z.coerce.number().default(300),
    SWAGGER_SERVER_URL: z.string().default("https://localhost/api/v1")
});
export const env = envSchema.parse(process.env);
