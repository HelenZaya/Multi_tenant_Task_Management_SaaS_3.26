import { z } from "zod";

export const changePlanSchema = z.object({
  plan: z.enum(["free", "pro", "enterprise"]),
});

export const updateSubscriptionSchema = z.object({
  status: z.enum(["active", "canceled", "past_due", "trialing"]).optional(),
  externalId: z.string().max(255).optional(),
  externalProvider: z.string().max(50).optional(),
  cancelAt: z.string().datetime().nullable().optional(),
  trialEnd: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const setFeatureFlagSchema = z.object({
  feature: z.string().min(1).max(100),
  enabled: z.boolean(),
  config: z.record(z.unknown()).optional(),
});

export const checkFeatureSchema = z.object({
  feature: z.string().min(1).max(100),
});

export const recordUsageSchema = z.object({
  metric: z.string().min(1).max(100),
  value: z.number().int().min(0).default(1),
});

export const getUsageQuerySchema = z.object({
  metric: z.string().min(1).max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ChangePlanInput = z.infer<typeof changePlanSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type SetFeatureFlagInput = z.infer<typeof setFeatureFlagSchema>;
export type CheckFeatureInput = z.infer<typeof checkFeatureSchema>;
export type RecordUsageInput = z.infer<typeof recordUsageSchema>;
export type GetUsageQuery = z.infer<typeof getUsageQuerySchema>;
