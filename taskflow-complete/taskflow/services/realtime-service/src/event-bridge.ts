import type { Server } from "socket.io";
import { subscribe } from "@taskflow/db";
import { createLogger, type DomainEvent, DOMAIN_EVENTS } from "@taskflow/utils";
import { projectRoom, userRoom, tenantRoom } from "./rooms.js";

const logger = createLogger("realtime-service:bridge");

/**
 * Bridges Redis pub/sub domain events to Socket.IO room broadcasts.
 * Each event is routed to the appropriate room(s).
 */
export async function startEventBridge(
  io: Server,
  redisUrl: string
): Promise<void> {
  logger.info("Starting event bridge (Redis → Socket.IO)...");

  await subscribe(redisUrl, "domain.events", (message: unknown) => {
    const event = message as DomainEvent;

    try {
      routeEvent(io, event);
    } catch (err) {
      logger.error(
        { err, eventType: event.type, eventId: event.id },
        "Failed to route event to Socket.IO"
      );
    }
  });

  logger.info("Event bridge started");
}

function routeEvent(io: Server, event: DomainEvent): void {
  const payload = event.payload as Record<string, unknown>;
  const projectId = payload["projectId"] as string | undefined;

  switch (event.type) {
    // ─── Task events → project room ─────────────────────
    case DOMAIN_EVENTS.TASK_CREATED:
      if (projectId) {
        io.to(projectRoom(projectId)).emit("task:created", {
          taskId: payload["taskId"],
          projectId,
          title: payload["title"],
          userId: event.userId,
          timestamp: event.timestamp,
        });
      }
      break;

    case DOMAIN_EVENTS.TASK_UPDATED:
      if (projectId) {
        io.to(projectRoom(projectId)).emit("task:updated", {
          taskId: payload["taskId"],
          projectId,
          changes: payload["changes"],
          userId: event.userId,
          timestamp: event.timestamp,
        });
      }
      break;

    case DOMAIN_EVENTS.TASK_MOVED:
      if (projectId) {
        io.to(projectRoom(projectId)).emit("task:moved", {
          taskId: payload["taskId"],
          projectId,
          fromColumnId: payload["fromColumnId"],
          toColumnId: payload["toColumnId"],
          userId: event.userId,
          timestamp: event.timestamp,
        });
      }
      break;

    case DOMAIN_EVENTS.TASK_DELETED:
      if (projectId) {
        io.to(projectRoom(projectId)).emit("task:deleted", {
          taskId: payload["taskId"],
          projectId,
          userId: event.userId,
          timestamp: event.timestamp,
        });
      }
      break;

    // ─── Comment events → project room ──────────────────
    case DOMAIN_EVENTS.COMMENT_ADDED:
      if (projectId) {
        io.to(projectRoom(projectId)).emit("comment:added", {
          commentId: payload["commentId"],
          taskId: payload["taskId"],
          projectId,
          content: payload["content"],
          userId: event.userId,
          timestamp: event.timestamp,
        });
      }
      break;

    // ─── Notification events → user room ────────────────
    case DOMAIN_EVENTS.NOTIFICATION_CREATED:
      io.to(userRoom(event.userId)).emit("notification:new", {
        notificationId: payload["notificationId"],
        type: payload["type"],
        title: payload["title"],
        body: payload["body"],
        data: payload["data"],
        timestamp: event.timestamp,
      });
      break;

    // ─── Member events → tenant room ────────────────────
    case DOMAIN_EVENTS.USER_INVITED:
      io.to(tenantRoom(event.tenantId)).emit("member:invited", {
        email: payload["email"],
        role: payload["role"],
        userId: event.userId,
        timestamp: event.timestamp,
      });
      break;

    case DOMAIN_EVENTS.MEMBER_ADDED:
      if (projectId) {
        io.to(projectRoom(projectId)).emit("member:added", {
          projectId,
          addedUserId: payload["addedUserId"],
          role: payload["role"],
          userId: event.userId,
          timestamp: event.timestamp,
        });
      }
      break;

    case DOMAIN_EVENTS.MEMBER_REMOVED:
      io.to(tenantRoom(event.tenantId)).emit("member:removed", {
        membershipId: payload["membershipId"],
        removedUserId: payload["removedUserId"],
        userId: event.userId,
        timestamp: event.timestamp,
      });
      break;

    // ─── Project events → tenant room ───────────────────
    case DOMAIN_EVENTS.PROJECT_CREATED:
      io.to(tenantRoom(event.tenantId)).emit("project:created", {
        projectId: payload["projectId"],
        name: payload["name"],
        slug: payload["slug"],
        userId: event.userId,
        timestamp: event.timestamp,
      });
      break;

    case DOMAIN_EVENTS.PROJECT_UPDATED:
      if (projectId) {
        io.to(projectRoom(projectId)).emit("project:updated", {
          projectId,
          changes: payload["changes"],
          userId: event.userId,
          timestamp: event.timestamp,
        });
      }
      break;

    default:
      logger.debug({ type: event.type }, "Unhandled event type in bridge");
  }
}
