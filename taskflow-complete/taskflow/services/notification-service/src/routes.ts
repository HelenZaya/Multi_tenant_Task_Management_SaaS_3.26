import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  successResponse,
  paginatedResponse,
  ValidationError,
} from "@taskflow/utils";
import { requireTenantContext } from "@taskflow/db";
import {
  listNotificationsQuerySchema,
  markReadSchema,
} from "./schemas.js";
import * as notificationService from "./service.js";
import { authMiddleware } from "./middleware.js";

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", requireTenantContext);

  // ─── GET /notifications ───────────────────────────────
  app.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = listNotificationsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await notificationService.listNotifications(
        request.tenantId!,
        request.userId!,
        parsed.data
      );
      return reply.send(
        paginatedResponse(
          result.notifications,
          result.total,
          result.page,
          result.limit
        )
      );
    }
  );

  // ─── GET /notifications/unread-count ──────────────────
  app.get(
    "/unread-count",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const count = await notificationService.getUnreadCount(
        request.tenantId!,
        request.userId!
      );
      return reply.send(successResponse({ count }));
    }
  );

  // ─── POST /notifications/mark-read ────────────────────
  app.post(
    "/mark-read",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = markReadSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await notificationService.markAsRead(
        request.tenantId!,
        request.userId!,
        parsed.data.notificationIds
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── POST /notifications/mark-all-read ────────────────
  app.post(
    "/mark-all-read",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await notificationService.markAllAsRead(
        request.tenantId!,
        request.userId!
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── DELETE /notifications/:notificationId ────────────
  app.delete(
    "/:notificationId",
    async (
      request: FastifyRequest<{ Params: { notificationId: string } }>,
      reply: FastifyReply
    ) => {
      await notificationService.deleteNotification(
        request.tenantId!,
        request.userId!,
        request.params.notificationId
      );
      return reply.send(successResponse({ message: "Notification deleted" }));
    }
  );
}
