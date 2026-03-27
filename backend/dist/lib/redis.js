import RedisModule from "ioredis";
import { env } from "../config/env.js";
const Redis = RedisModule;
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const redisSubscriber = redis.duplicate();
