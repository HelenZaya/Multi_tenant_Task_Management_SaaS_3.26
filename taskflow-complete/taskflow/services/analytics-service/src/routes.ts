import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { successResponse, ValidationError } from "@taskflow/utils";
import { requireTenantContext } from "@taskflow/db";
import {
  dashboardQuerySchema,
  projectAnalyticsQuerySchema,
  userProductivityQuerySchema,
} from "./schemas.js";
import * as analyticsService from "./service.js";
import { authMiddleware } from "./middleware.js";

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", requireTenantContext);

  // ─── GET /analytics/dashboard ─────────────────────────
  app.get("/dashboard", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = dashboardQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const result = await analyticsService.getDashboard(req.tenantId!, parsed.data);
    return reply.send(successResponse(result));
  });

  // ─── GET /analytics/projects ──────────────────────────
  app.get("/projects", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = projectAnalyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const result = await analyticsService.getProjectAnalytics(req.tenantId!, parsed.data);
    return reply.send(successResponse(result));
  });

  // ─── GET /analytics/productivity ──────────────────────
  app.get("/productivity", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = userProductivityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const result = await analyticsService.getUserProductivity(req.tenantId!, parsed.data);
    return reply.send(successResponse(result));
  });

  // ─── POST /analytics/refresh/summaries ────────────────
  // Manually trigger CQRS read model refresh (also done by worker)
  app.post("/refresh/summaries", async (req: FastifyRequest, reply: FastifyReply) => {
    await analyticsService.refreshProjectSummaries(req.tenantId!);
    return reply.send(successResponse({ message: "Project summaries refreshed" }));
  });

  // ─── POST /analytics/refresh/daily ────────────────────
  app.post("/refresh/daily", async (req: FastifyRequest, reply: FastifyReply) => {
    await analyticsService.refreshDailyMetrics(req.tenantId!);
    return reply.send(successResponse({ message: "Daily metrics refreshed" }));
  });
}
