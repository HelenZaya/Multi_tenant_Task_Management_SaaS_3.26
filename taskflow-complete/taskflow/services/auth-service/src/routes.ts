import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { successResponse, ValidationError } from "@taskflow/utils";
import {
  registerTenantSchema,
  registerUserSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
} from "./schemas.js";
import * as authService from "./service.js";
import { authMiddleware } from "./middleware.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /auth/register-tenant ─────────────────────────
  app.post(
    "/register-tenant",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = registerTenantSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await authService.registerTenant(parsed.data);
      return reply.status(201).send(successResponse(result));
    }
  );

  // ─── POST /auth/register ───────────────────────────────
  app.post(
    "/register",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = registerUserSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await authService.registerUser(parsed.data);
      return reply.status(201).send(successResponse(result));
    }
  );

  // ─── POST /auth/login ─────────────────────────────────
  app.post(
    "/login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await authService.login(parsed.data);
      return reply.status(200).send(successResponse(result));
    }
  );

  // ─── POST /auth/refresh ───────────────────────────────
  app.post(
    "/refresh",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = refreshTokenSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await authService.refresh(parsed.data.refreshToken);
      return reply.status(200).send(successResponse(result));
    }
  );

  // ─── POST /auth/logout ────────────────────────────────
  app.post(
    "/logout",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = logoutSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          "Validation failed",
          parsed.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      await authService.logout(parsed.data.refreshToken);
      return reply.status(200).send(successResponse({ message: "Logged out" }));
    }
  );

  // ─── GET /auth/me (protected) ─────────────────────────
  app.get(
    "/me",
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const profile = await authService.getProfile(
        request.userId!,
        request.tenantId!
      );
      return reply.status(200).send(successResponse(profile));
    }
  );
}
