import { redis } from "./redis.js";

export const cacheKeys = {
  board: (tenantId: string, boardId: string) => `board:${tenantId}:${boardId}`,
  dashboard: (tenantId: string) => `dashboard:${tenantId}`,
  report: (tenantId: string) => `report:${tenantId}`
};

export async function getCached<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  return value ? (JSON.parse(value) as T) : null;
}

export async function setCached(key: string, value: unknown, ttlSeconds: number) {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function invalidateCache(keys: string[]) {
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
