import { z } from "zod";
import { nameSchema, slugSchema, uuidSchema } from "@taskflow/utils";

export const createProjectSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
    .optional(),
});

export const updateProjectSchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(2000).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
    .optional(),
});

export const addProjectMemberSchema = z.object({
  userId: uuidSchema,
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export const updateProjectMemberSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  archived: z.coerce.boolean().default(false),
  search: z.string().max(255).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
