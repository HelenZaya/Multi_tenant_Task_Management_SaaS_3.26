import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  successResponse,
  paginatedResponse,
  ValidationError,
} from "@taskflow/utils";
import { requireTenantContext } from "@taskflow/db";
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  updateProjectMemberSchema,
  listProjectsQuerySchema,
} from "./schemas.js";
import * as projectService from "./service.js";
import { authMiddleware } from "./middleware.js";

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", requireTenantContext);

  // ─── POST /projects ───────────────────────────────────
  app.post(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = createProjectSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await projectService.createProject(
        request.tenantId!,
        request.userId!,
        parsed.data
      );
      return reply.status(201).send(successResponse(result));
    }
  );

  // ─── GET /projects ────────────────────────────────────
  app.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = listProjectsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await projectService.listProjects(
        request.tenantId!,
        request.userId!,
        parsed.data
      );
      return reply.send(
        paginatedResponse(result.projects, result.total, result.page, result.limit)
      );
    }
  );

  // ─── GET /projects/:projectId ─────────────────────────
  app.get(
    "/:projectId",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply
    ) => {
      const result = await projectService.getProject(
        request.tenantId!,
        request.params.projectId
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── PATCH /projects/:projectId ───────────────────────
  app.patch(
    "/:projectId",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply
    ) => {
      const parsed = updateProjectSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await projectService.updateProject(
        request.tenantId!,
        request.userId!,
        request.params.projectId,
        parsed.data
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── DELETE /projects/:projectId ──────────────────────
  app.delete(
    "/:projectId",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply
    ) => {
      await projectService.deleteProject(
        request.tenantId!,
        request.userId!,
        request.params.projectId
      );
      return reply.send(successResponse({ message: "Project deleted" }));
    }
  );

  // ─── POST /projects/:projectId/archive ────────────────
  app.post(
    "/:projectId/archive",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply
    ) => {
      const result = await projectService.archiveProject(
        request.tenantId!,
        request.userId!,
        request.params.projectId,
        true
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── POST /projects/:projectId/unarchive ──────────────
  app.post(
    "/:projectId/unarchive",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply
    ) => {
      const result = await projectService.archiveProject(
        request.tenantId!,
        request.userId!,
        request.params.projectId,
        false
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── GET /projects/:projectId/progress ────────────────
  app.get(
    "/:projectId/progress",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply
    ) => {
      const result = await projectService.getProjectProgress(
        request.tenantId!,
        request.params.projectId
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── GET /projects/:projectId/boards ──────────────────
  app.get(
    "/:projectId/boards",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply
    ) => {
      const result = await projectService.getProjectBoards(
        request.tenantId!,
        request.params.projectId
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── GET /projects/:projectId/members ─────────────────
  app.get(
    "/:projectId/members",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply
    ) => {
      const result = await projectService.listProjectMembers(
        request.tenantId!,
        request.params.projectId
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── POST /projects/:projectId/members ────────────────
  app.post(
    "/:projectId/members",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply
    ) => {
      const parsed = addProjectMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await projectService.addProjectMember(
        request.tenantId!,
        request.userId!,
        request.params.projectId,
        parsed.data
      );
      return reply.status(201).send(successResponse(result));
    }
  );

  // ─── PATCH /projects/:projectId/members/:memberId ─────
  app.patch(
    "/:projectId/members/:memberId",
    async (
      request: FastifyRequest<{
        Params: { projectId: string; memberId: string };
      }>,
      reply: FastifyReply
    ) => {
      const parsed = updateProjectMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await projectService.updateProjectMemberRole(
        request.tenantId!,
        request.userId!,
        request.params.projectId,
        request.params.memberId,
        parsed.data
      );
      return reply.send(successResponse(result));
    }
  );

  // ─── DELETE /projects/:projectId/members/:memberId ────
  app.delete(
    "/:projectId/members/:memberId",
    async (
      request: FastifyRequest<{
        Params: { projectId: string; memberId: string };
      }>,
      reply: FastifyReply
    ) => {
      await projectService.removeProjectMember(
        request.tenantId!,
        request.userId!,
        request.params.projectId,
        request.params.memberId
      );
      return reply.send(successResponse({ message: "Member removed" }));
    }
  );
}
