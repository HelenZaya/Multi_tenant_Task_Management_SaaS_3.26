import { z } from "zod";
import { nameSchema, uuidSchema } from "@taskflow/utils";

// ─── Board schemas ──────────────────────────────────────────
export const createBoardSchema = z.object({
  projectId: uuidSchema,
  name: nameSchema,
});

export const updateBoardSchema = z.object({
  name: nameSchema.optional(),
});

// ─── Column schemas ─────────────────────────────────────────
export const createColumnSchema = z.object({
  boardId: uuidSchema,
  name: nameSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  wipLimit: z.number().int().min(1).optional(),
});

export const updateColumnSchema = z.object({
  name: nameSchema.optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  wipLimit: z.number().int().min(1).nullable().optional(),
});

export const moveColumnSchema = z.object({
  beforePosition: z.string().nullable().optional(),
  afterPosition: z.string().nullable().optional(),
});

// ─── Task schemas ───────────────────────────────────────────
export const createTaskSchema = z.object({
  projectId: uuidSchema,
  columnId: uuidSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).default("none"),
  assigneeId: uuidSchema.optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().min(0).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  beforePosition: z.string().nullable().optional(),
  afterPosition: z.string().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  status: z.enum(["todo", "in_progress", "in_review", "done", "archived"]).optional(),
  assigneeId: uuidSchema.nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().min(0).nullable().optional(),
  actualHours: z.number().min(0).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const moveTaskSchema = z.object({
  columnId: uuidSchema,
  beforePosition: z.string().nullable().optional(),
  afterPosition: z.string().nullable().optional(),
});

export const listTasksQuerySchema = z.object({
  projectId: uuidSchema,
  columnId: uuidSchema.optional(),
  status: z.enum(["todo", "in_progress", "in_review", "done", "archived"]).optional(),
  assigneeId: uuidSchema.optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ─── Comment schemas ────────────────────────────────────────
export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

// ─── Attachment schemas ─────────────────────────────────────
export const createAttachmentSchema = z.object({
  filename: z.string().min(1).max(500),
  fileSize: z.number().int().min(1),
  mimeType: z.string().min(1).max(255),
  storageKey: z.string().min(1).max(1024),
  storageUrl: z.string().url().optional(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type MoveColumnInput = z.infer<typeof moveColumnSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
