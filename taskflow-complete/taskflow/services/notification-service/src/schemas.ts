import { z } from "zod";
import { uuidSchema } from "@taskflow/utils";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

export const markReadSchema = z.object({
  notificationIds: z.array(uuidSchema).min(1).max(100),
});

export const markAllReadSchema = z.object({});

export const createNotificationSchema = z.object({
  userId: uuidSchema,
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(500),
  body: z.string().max(2000).optional(),
  data: z.record(z.unknown()).optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
