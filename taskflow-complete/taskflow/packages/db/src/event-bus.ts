import { publish, subscribe } from "./redis.js";
import { createLogger } from "@taskflow/utils";
import type { DomainEvent, DomainEventType } from "@taskflow/utils";
import { randomUUID } from "node:crypto";

const logger = createLogger("db:event-bus");

const DOMAIN_CHANNEL = "domain.events";
const WORKER_CHANNEL = "worker.jobs";

type EventHandler = (event: DomainEvent) => void | Promise<void>;

const handlers = new Map<string, EventHandler[]>();

// ─── Publish domain event ───────────────────────────────────
export async function publishDomainEvent(event: DomainEvent): Promise<void> {
  await publish(DOMAIN_CHANNEL, event);
  logger.debug({ type: event.type, id: event.id }, "Domain event published");
}

// ─── Convenience builder ────────────────────────────────────
export function buildDomainEvent(
  type: DomainEventType,
  tenantId: string,
  userId: string,
  payload: unknown,
  correlationId?: string
): DomainEvent {
  return {
    id: randomUUID(),
    type,
    tenantId,
    userId,
    payload,
    timestamp: new Date().toISOString(),
    correlationId,
  };
}

// ─── Publish worker job ─────────────────────────────────────
export interface WorkerJob {
  type: string;
  tenantId: string;
  payload: Record<string, unknown>;
  priority?: number;
  delay?: number;
}

export async function publishWorkerJob(job: WorkerJob): Promise<void> {
  await publish(WORKER_CHANNEL, job);
  logger.debug({ type: job.type, tenantId: job.tenantId }, "Worker job published");
}

// ─── Subscribe to domain events ─────────────────────────────
export async function subscribeDomainEvents(
  redisUrl: string,
  handler: EventHandler
): Promise<void> {
  await subscribe(redisUrl, DOMAIN_CHANNEL, (message: unknown) => {
    const event = message as DomainEvent;
    handler(event);
  });
  logger.info("Subscribed to domain events");
}

// ─── Subscribe to specific event types ──────────────────────
export function onDomainEvent(
  eventType: DomainEventType,
  handler: EventHandler
): void {
  const existing = handlers.get(eventType) ?? [];
  existing.push(handler);
  handlers.set(eventType, existing);
}

export async function startTypedEventRouter(redisUrl: string): Promise<void> {
  await subscribe(redisUrl, DOMAIN_CHANNEL, async (message: unknown) => {
    const event = message as DomainEvent;
    const eventHandlers = handlers.get(event.type) ?? [];

    for (const handler of eventHandlers) {
      try {
        await handler(event);
      } catch (err) {
        logger.error(
          { err, eventType: event.type, eventId: event.id },
          "Event handler failed"
        );
      }
    }
  });
  logger.info(`Typed event router started with ${handlers.size} event types registered`);
}

// ─── Subscribe to worker jobs ───────────────────────────────
export async function subscribeWorkerJobs(
  redisUrl: string,
  handler: (job: WorkerJob) => void | Promise<void>
): Promise<void> {
  await subscribe(redisUrl, WORKER_CHANNEL, (message: unknown) => {
    const job = message as WorkerJob;
    handler(job);
  });
  logger.info("Subscribed to worker jobs");
}
