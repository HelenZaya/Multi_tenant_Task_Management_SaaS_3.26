import { redis } from "./redis.js";
export const cacheKeys = {
    board: (tenantId, boardId) => `board:${tenantId}:${boardId}`,
    dashboard: (tenantId) => `dashboard:${tenantId}`,
    report: (tenantId) => `report:${tenantId}`
};
export async function getCached(key) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
}
export async function setCached(key, value, ttlSeconds) {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}
export async function invalidateCache(keys) {
    if (keys.length > 0) {
        await redis.del(...keys);
    }
}
