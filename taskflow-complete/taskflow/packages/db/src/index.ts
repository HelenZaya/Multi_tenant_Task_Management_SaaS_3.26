export {
  createPool,
  getPool,
  closePool,
  query,
  queryWithTenant,
  transaction,
  transactionWithTenant,
  type PoolConfig,
} from "./postgres.js";

export {
  createRedis,
  getRedis,
  getRedisPublisher,
  getRedisSubscriber,
  closeRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  publish,
  subscribe,
} from "./redis.js";

export {
  tenantContextMiddleware,
  requireTenantContext,
  registerTenantContext,
} from "./tenant-context.js";

export { checkHealth, type HealthStatus } from "./health.js";

export {
  paginationClause,
  orderByClause,
  softDeleteClause,
  whereIn,
  buildInsert,
  buildUpdate,
  type PaginationParams,
  type SortParams,
} from "./query-helpers.js";

export { runMigrations } from "./migrate.js";

export {
  publishDomainEvent,
  buildDomainEvent,
  publishWorkerJob,
  subscribeDomainEvents,
  subscribeWorkerJobs,
  onDomainEvent,
  startTypedEventRouter,
  type WorkerJob,
} from "./event-bus.js";
