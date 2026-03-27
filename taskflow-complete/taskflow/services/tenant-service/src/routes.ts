import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  successResponse,
  paginatedResponse,
  ValidationError,
} from "@taskflow/utils";
import { requireTenantContext } from "@taskflow/db";
import {
  updateTenantSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  listMembersQuerySchema,
} from "./schemas.js";
import * as tenantService from "./service.js";
import { authMiddleware } from "./middleware.js";

export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  // All routes require authentication
  app.addHook("preHandler", authMiddleware);

  // ─── GET /tenants/current ─────────────────────────────
  app.get(
    "/current",
    { preHandler: [requireTenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenant = await tenantService.getTenant(request.tenantId!);
      return reply.send(successResponse(tenant));
    }
  );

  // ─── PATCH /tenants/current ───────────────────────────
  app.patch(
    "/current",
    { preHandler: [requireTenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = updateTenantSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const tenant = await tenantService.updateTenant(
        request.tenantId!,
        request.userId!,
        parsed.data
      );
      return reply.send(successResponse(tenant));
    }
  );

  // ─── GET /tenants/mine ────────────────────────────────
  // List all tenants the current user belongs to
  app.get(
    "/mine",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenants = await tenantService.getUserTenants(request.userId!);
      return reply.send(successResponse(tenants));
    }
  );

  // ─── GET /tenants/members ─────────────────────────────
  app.get(
    "/members",
    { preHandler: [requireTenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = listMembersQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await tenantService.listMembers(
        request.tenantId!,
        parsed.data
      );
      return reply.send(
        paginatedResponse(result.members, result.total, result.page, result.limit)
      );
    }
  );

  // ─── POST /tenants/members/invite ─────────────────────
  app.post(
    "/members/invite",
    { preHandler: [requireTenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = inviteMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await tenantService.inviteMember(
        request.tenantId!,
        request.userId!,
        parsed.data
      );
      return reply.status(201).send(successResponse(result));
    }
  );

  // ─── PATCH /tenants/members/:membershipId/role ────────
  app.patch<{ Params: { membershipId: string } }>(
    "/members/:membershipId/role",
    { preHandler: [requireTenantContext] },
    async (request, reply) => {
      const parsed = updateMemberRoleSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await tenantService.updateMemberRole(
        request.tenantId!,
        request.userId!,
        request.params.membershipId,
        parsed.data
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── DELETE /tenants/members/:membershipId ────────────
  app.delete<{ Params: { membershipId: string } }>(
    "/members/:membershipId",
    { preHandler: [requireTenantContext] },
    async (request, reply) => {
      await tenantService.removeMember(
        request.tenantId!,
        request.userId!,
        request.params.membershipId
      );
      return reply.send(successResponse({ message: "Member removed" }));
    }
  );

  // ─── POST /tenants/leave ──────────────────────────────
  app.post(
    "/leave",
    { preHandler: [requireTenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await tenantService.leaveWorkspace(request.tenantId!, request.userId!);
      return reply.send(successResponse({ message: "Left workspace" }));
    }
  );
}
