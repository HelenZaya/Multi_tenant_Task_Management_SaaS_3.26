import { OutboxStatus } from "@prisma/client";
import { prisma } from "./prisma.js";
import { redis } from "./redis.js";
export async function publishDomainEvent(tenantId, eventType, payload) {
    const event = await prisma.outboxEvent.create({
        data: {
            tenantId,
            eventType,
            payload: payload
        }
    });
    await redis.publish("domain-events", JSON.stringify({
        id: event.id,
        tenantId,
        eventType,
        payload,
        createdAt: event.createdAt.toISOString()
    }));
    await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: OutboxStatus.PROCESSED, processedAt: new Date() }
    });
}
