import { Redis } from "ioredis";
import { createLogger } from "@taskflow/utils";

const logger = createLogger("db:redis");

let redisClient: Redis | null = null;
let redisSub: Redis | null = null;
let redisPub: Redis | null = null;

function createRedisInstance(url: string, name: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    lazyConnect: false,
  });

  client.on("connect", () => logger.info(`Redis ${name} connected`));
  client.on("error", (err: unknown) => logger.error({ err }, `Redis ${name} error`));
  client.on("close", () => logger.warn(`Redis ${name} closed`));

  return client;
}

export function createRedis(url: string): Redis {
  if (redisClient) return redisClient;
  redisClient = createRedisInstance(url, "client");
  return redisClient;
}

export function getRedis(): Redis {
  if (!redisClient) {
    throw new Error("Redis not initialized. Call createRedis() first.");
  }
  return redisClient;
}

export function getRedisPublisher(url: string): Redis {
  if (!redisPub) {
    redisPub = createRedisInstance(url, "publisher");
  }
  return redisPub;
}

export function getRedisSubscriber(url: string): Redis {
  if (!redisSub) {
    redisSub = createRedisInstance(url, "subscriber");
  }
  return redisSub;
}

export async function closeRedis(): Promise<void> {
  const clients = [redisClient, redisSub, redisPub];
  await Promise.all(
    clients.map(async (c) => {
      if (c) {
        c.disconnect();
      }
    })
  );
  redisClient = null;
  redisSub = null;
  redisPub = null;
  logger.info("All Redis connections closed");
}

// ─── Cache helpers ──────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = 300
): Promise<void> {
  await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await getRedis().del(key);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = getRedis();
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}

// ─── Pub/Sub helpers ────────────────────────────────────────

export async function publish(channel: string, message: unknown): Promise<void> {
  const redis = getRedis();
  await redis.publish(channel, JSON.stringify(message));
}

export async function subscribe(
  url: string,
  channel: string,
  handler: (message: unknown) => void
): Promise<void> {
  const sub = getRedisSubscriber(url);
  await sub.subscribe(channel);
  sub.on("message", (ch: string, raw: string) => {
    if (ch === channel) {
      try {
        handler(JSON.parse(raw));
      } catch (err) {
        logger.error({ err, channel }, "Failed to parse pub/sub message");
      }
    }
  });
}
