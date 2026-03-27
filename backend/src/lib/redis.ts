import RedisModule from "ioredis";
import { env } from "../config/env.js";

const Redis = RedisModule as unknown as new (url: string, options?: Record<string, unknown>) => {
  duplicate: () => typeof redis;
  get: (key: string) => Promise<string | null>;
  set: (...args: unknown[]) => Promise<unknown>;
  del: (...keys: string[]) => Promise<number>;
  publish: (channel: string, message: string) => Promise<number>;
};

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const redisSubscriber = redis.duplicate();
