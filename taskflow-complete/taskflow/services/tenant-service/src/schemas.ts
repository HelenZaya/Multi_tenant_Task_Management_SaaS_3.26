import { z } from "zod";
import { nameSchema, emailSchema } from "@taskflow/utils";

export const updateTenantSchema = z.object({
  name: nameSchema.optional(),
  settings: z.record(z.unknown()).optional(),
});

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

export const acceptInviteSchema = z.object({
  inviteCode: z.string().min(1),
});

export const listMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(["owner", "admin", "member", "viewer"]).optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
