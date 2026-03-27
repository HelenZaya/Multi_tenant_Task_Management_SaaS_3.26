import { OutboxStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { redis } from "./redis.js";

export type DomainEventType = "card.created" | "card.updated" | "card.moved" | "user.invited";

export async function publishDomainEvent(tenantId: string, eventType: DomainEventType, payload: Record<string, unknown>) {
  const event = await prisma.outboxEvent.create({
    data: {
      tenantId,
      eventType,
      payload: payload as Prisma.InputJsonValue
    }
  });

  await redis.publish(
    "domain-events",
    JSON.stringify({
      id: event.id,
      tenantId,
      eventType,
      payload,
      createdAt: event.createdAt.toISOString()
    })
  );

  await prisma.outboxEvent.update({
    where: { id: event.id },
    data: { status: OutboxStatus.PROCESSED, processedAt: new Date() }
  });
}
