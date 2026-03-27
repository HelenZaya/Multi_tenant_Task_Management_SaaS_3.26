import { z } from "zod";
import { uuidSchema } from "@taskflow/utils";

export const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
});

export const projectAnalyticsQuerySchema = dateRangeSchema.extend({
  projectId: uuidSchema,
});

export const userProductivityQuerySchema = dateRangeSchema.extend({
  userId: uuidSchema.optional(),
});

export const dashboardQuerySchema = dateRangeSchema.extend({});

export type DateRangeQuery = z.infer<typeof dateRangeSchema>;
export type ProjectAnalyticsQuery = z.infer<typeof projectAnalyticsQuerySchema>;
export type UserProductivityQuery = z.infer<typeof userProductivityQuerySchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
