import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { successResponse, ValidationError } from "@taskflow/utils";
import { requireTenantContext } from "@taskflow/db";
import {
  changePlanSchema,
  updateSubscriptionSchema,
  setFeatureFlagSchema,
  checkFeatureSchema,
  recordUsageSchema,
  getUsageQuerySchema,
} from "./schemas.js";
import * as billingService from "./service.js";
import { authMiddleware } from "./middleware.js";

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", requireTenantContext);

  // ─── GET /billing/plans ───────────────────────────────
  app.get("/plans", async (_req: FastifyRequest, reply: FastifyReply) => {
    const plans = billingService.getAllPlans();
    return reply.send(successResponse(plans));
  });

  // ─── GET /billing/overview ────────────────────────────
  app.get("/overview", async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await billingService.getTenantBillingOverview(req.tenantId!);
    return reply.send(successResponse(result));
  });

  // ─── GET /billing/subscription ────────────────────────
  app.get("/subscription", async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await billingService.getSubscription(req.tenantId!);
    return reply.send(successResponse(result));
  });

  // ─── POST /billing/change-plan ────────────────────────
  app.post("/change-plan", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = changePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const result = await billingService.changePlan(req.tenantId!, req.userId!, parsed.data);
    return reply.send(successResponse(result));
  });

  // ─── POST /billing/cancel ────────────────────────────
  app.post("/cancel", async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await billingService.cancelSubscription(req.tenantId!, req.userId!);
    return reply.send(successResponse(result));
  });

  // ─── PATCH /billing/subscription ──────────────────────
  app.patch("/subscription", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = updateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const result = await billingService.updateSubscription(req.tenantId!, parsed.data);
    return reply.send(successResponse(result));
  });

  // ─── GET /billing/limits/members ──────────────────────
  app.get("/limits/members", async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await billingService.checkMemberLimit(req.tenantId!);
    return reply.send(successResponse(result));
  });

  // ─── GET /billing/limits/projects ─────────────────────
  app.get("/limits/projects", async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await billingService.checkProjectLimit(req.tenantId!);
    return reply.send(successResponse(result));
  });

  // ─── POST /billing/limits/check-tasks ─────────────────
  app.post(
    "/limits/check-tasks",
    async (req: FastifyRequest<{ Body: { projectId: string } }>, reply: FastifyReply) => {
      const projectId = (req.body as Record<string, string>)?.projectId;
      if (!projectId) throw new ValidationError("projectId is required");
      const result = await billingService.checkTaskLimit(req.tenantId!, projectId);
      return reply.send(successResponse(result));
    }
  );

  // ═══ FEATURE FLAGS ════════════════════════════════════

  // ─── GET /billing/features ────────────────────────────
  app.get("/features", async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await billingService.getFeatureFlags(req.tenantId!);
    return reply.send(successResponse(result));
  });

  // ─── GET /billing/features/check ──────────────────────
  app.get(
    "/features/check",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = checkFeatureSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
      }
      const enabled = await billingService.checkFeature(req.tenantId!, parsed.data.feature);
      return reply.send(successResponse({ feature: parsed.data.feature, enabled }));
    }
  );

  // ─── POST /billing/features ───────────────────────────
  app.post("/features", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = setFeatureFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const result = await billingService.setFeatureFlag(req.tenantId!, parsed.data);
    return reply.send(successResponse(result));
  });

  // ─── DELETE /billing/features/:feature ────────────────
  app.delete(
    "/features/:feature",
    async (req: FastifyRequest<{ Params: { feature: string } }>, reply: FastifyReply) => {
      await billingService.deleteFeatureFlag(req.tenantId!, req.params.feature);
      return reply.send(successResponse({ message: "Feature flag deleted" }));
    }
  );

  // ═══ USAGE TRACKING ═══════════════════════════════════

  // ─── POST /billing/usage ──────────────────────────────
  app.post("/usage", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = recordUsageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const result = await billingService.recordUsage(req.tenantId!, parsed.data);
    return reply.send(successResponse(result));
  });

  // ─── GET /billing/usage ───────────────────────────────
  app.get("/usage", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = getUsageQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const result = await billingService.getUsage(req.tenantId!, parsed.data);
    return reply.send(successResponse(result));
  });

  // ─── GET /billing/usage/summary ───────────────────────
  app.get("/usage/summary", async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await billingService.getUsageSummary(req.tenantId!);
    return reply.send(successResponse(result));
  });
}
