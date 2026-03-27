import { query } from "@taskflow/db";
import { createLogger } from "@taskflow/utils";

const logger = createLogger("worker:notifications");

/**
 * Process pending notification emails.
 * Finds notifications that haven't been emailed yet and queues them.
 */
export async function processNotificationEmails(): Promise<void> {
  const { rows } = await query(
    `SELECT n.id, n.tenant_id, n.user_id, n.type, n.title, n.body, n.data,
            u.email, u.full_name
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     WHERE n.email_sent = false
     AND n.created_at >= NOW() - INTERVAL '1 hour'
     ORDER BY n.created_at ASC
     LIMIT 100`
  );

  if (rows.length === 0) {
    logger.debug("No pending notification emails");
    return;
  }

  logger.info({ count: rows.length }, "Processing notification emails");

  for (const notification of rows) {
    try {
      // In production, send actual email here
      // await emailProvider.send({
      //   to: notification.email,
      //   subject: notification.title,
      //   html: renderTemplate(notification),
      // });

      logger.info(
        {
          notificationId: notification.id,
          email: notification.email,
          type: notification.type,
        },
        "[DEV] Would send notification email"
      );

      // Mark as sent
      await query(
        "UPDATE notifications SET email_sent = true, email_sent_at = NOW() WHERE id = $1",
        [notification.id]
      );
    } catch (err) {
      logger.error(
        { err, notificationId: notification.id },
        "Failed to send notification email"
      );
    }
  }

  logger.info({ processed: rows.length }, "Notification emails processed");
}

/**
 * Clean up old notifications (> 90 days).
 */
export async function cleanupOldNotifications(): Promise<void> {
  const { rowCount } = await query(
    "DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days'"
  );

  if (rowCount && rowCount > 0) {
    logger.info({ deleted: rowCount }, "Old notifications cleaned up");
  }
}
