import { queryWithTenant, publish } from "@taskflow/db";
import {
  generateId,
  NotFoundError,
  createLogger,
  DOMAIN_EVENTS,
  type DomainEvent,
} from "@taskflow/utils";
import type {
  CreateNotificationInput,
  ListNotificationsQuery,
} from "./schemas.js";

const logger = createLogger("notification-service:service");

// ─── Create Notification ────────────────────────────────────
export async function createNotification(
  tenantId: string,
  input: CreateNotificationInput
) {
  const notificationId = generateId();

  const { rows } = await queryWithTenant(
    tenantId,
    `INSERT INTO notifications (id, tenant_id, user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, type, title, body, data, is_read, created_at`,
    [
      notificationId,
      tenantId,
      input.userId,
      input.type,
      input.title,
      input.body ?? null,
      JSON.stringify(input.data ?? {}),
    ]
  );

  // Publish notification.created for realtime delivery
  const event: DomainEvent = {
    id: generateId(),
    type: DOMAIN_EVENTS.NOTIFICATION_CREATED,
    tenantId,
    userId: input.userId,
    payload: {
      notificationId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
    },
    timestamp: new Date().toISOString(),
  };
  await publish("domain.events", event);

  logger.info({ tenantId, notificationId, userId: input.userId, type: input.type }, "Notification created");
  return rows[0];
}

// ─── List Notifications ─────────────────────────────────────
export async function listNotifications(
  tenantId: string,
  userId: string,
  queryParams: ListNotificationsQuery
) {
  const { page, limit, unreadOnly } = queryParams;
  const offset = (page - 1) * limit;

  let whereClause = "user_id = $1";
  const values: unknown[] = [userId];
  let idx = 2;

  if (unreadOnly) {
    whereClause += " AND is_read = false";
  }

  // Count
  const { rows: countRows } = await queryWithTenant(
    tenantId,
    `SELECT COUNT(*)::int AS total FROM notifications WHERE ${whereClause}`,
    values
  );
  const total = countRows[0]?.total ?? 0;

  // Fetch
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT id, type, title, body, data, is_read, read_at, email_sent, created_at
     FROM notifications
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  return { notifications: rows, total, page, limit };
}

// ─── Get Unread Count ───────────────────────────────────────
export async function getUnreadCount(tenantId: string, userId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false",
    [userId]
  );
  return rows[0]?.count ?? 0;
}

// ─── Mark Notifications as Read ─────────────────────────────
export async function markAsRead(
  tenantId: string,
  userId: string,
  notificationIds: string[]
) {
  const placeholders = notificationIds.map((_, i) => `$${i + 2}`).join(", ");
  const { rowCount } = await queryWithTenant(
    tenantId,
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE user_id = $1 AND id IN (${placeholders}) AND is_read = false`,
    [userId, ...notificationIds]
  );
  return { updated: rowCount ?? 0 };
}

// ─── Mark All as Read ───────────────────────────────────────
export async function markAllAsRead(tenantId: string, userId: string) {
  const { rowCount } = await queryWithTenant(
    tenantId,
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return { updated: rowCount ?? 0 };
}

// ─── Delete Notification ────────────────────────────────────
export async function deleteNotification(
  tenantId: string,
  userId: string,
  notificationId: string
) {
  const { rowCount } = await queryWithTenant(
    tenantId,
    "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
    [notificationId, userId]
  );
  if (rowCount === 0) throw new NotFoundError("Notification", notificationId);
}

// ─── Mark as Email Sent ─────────────────────────────────────
export async function markEmailSent(
  tenantId: string,
  notificationId: string
) {
  await queryWithTenant(
    tenantId,
    "UPDATE notifications SET email_sent = true, email_sent_at = NOW() WHERE id = $1",
    [notificationId]
  );
}
