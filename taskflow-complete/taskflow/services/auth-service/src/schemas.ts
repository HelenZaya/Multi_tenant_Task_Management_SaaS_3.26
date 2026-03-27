import { z } from "zod";
import { emailSchema, passwordSchema, nameSchema, slugSchema } from "@taskflow/utils";

export const registerTenantSchema = z.object({
  tenantName: nameSchema,
  tenantSlug: slugSchema,
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const registerUserSchema = z.object({
  tenantId: z.string().uuid(),
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  inviteCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
