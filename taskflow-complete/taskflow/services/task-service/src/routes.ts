import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  successResponse,
  paginatedResponse,
  ValidationError,
} from "@taskflow/utils";
import { requireTenantContext } from "@taskflow/db";
import * as svc from "./service.js";
import * as s from "./schemas.js";
import { authMiddleware } from "./middleware.js";

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", requireTenantContext);

  // ═══════════════════════════════════════════════════════
  // BOARDS
  // ═══════════════════════════════════════════════════════

  app.post("/boards", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = s.createBoardSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.createBoard(req.tenantId!, req.userId!, parsed.data);
    return reply.status(201).send(successResponse(result));
  });

  app.patch("/boards/:boardId", async (req: FastifyRequest<{ Params: { boardId: string } }>, reply: FastifyReply) => {
    const parsed = s.updateBoardSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.updateBoard(req.tenantId!, req.params.boardId, parsed.data);
    return reply.send(successResponse(result));
  });

  app.delete("/boards/:boardId", async (req: FastifyRequest<{ Params: { boardId: string } }>, reply: FastifyReply) => {
    await svc.deleteBoard(req.tenantId!, req.params.boardId);
    return reply.send(successResponse({ message: "Board deleted" }));
  });

  // ═══════════════════════════════════════════════════════
  // COLUMNS
  // ═══════════════════════════════════════════════════════

  app.post("/columns", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = s.createColumnSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.createColumn(req.tenantId!, req.userId!, parsed.data);
    return reply.status(201).send(successResponse(result));
  });

  app.patch("/columns/:columnId", async (req: FastifyRequest<{ Params: { columnId: string } }>, reply: FastifyReply) => {
    const parsed = s.updateColumnSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.updateColumn(req.tenantId!, req.params.columnId, parsed.data);
    return reply.send(successResponse(result));
  });

  app.post("/columns/:columnId/move", async (req: FastifyRequest<{ Params: { columnId: string } }>, reply: FastifyReply) => {
    const parsed = s.moveColumnSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.moveColumn(req.tenantId!, req.params.columnId, parsed.data);
    return reply.send(successResponse(result));
  });

  app.delete("/columns/:columnId", async (req: FastifyRequest<{ Params: { columnId: string } }>, reply: FastifyReply) => {
    await svc.deleteColumn(req.tenantId!, req.params.columnId);
    return reply.send(successResponse({ message: "Column deleted" }));
  });

  // ═══════════════════════════════════════════════════════
  // TASKS
  // ═══════════════════════════════════════════════════════

  app.post("/tasks", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = s.createTaskSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.createTask(req.tenantId!, req.userId!, parsed.data);
    return reply.status(201).send(successResponse(result));
  });

  app.get("/tasks", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = s.listTasksQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.listTasks(req.tenantId!, parsed.data);
    return reply.send(paginatedResponse(result.tasks, result.total, result.page, result.limit));
  });

  app.get("/tasks/:taskId", async (req: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const result = await svc.getTask(req.tenantId!, req.params.taskId);
    return reply.send(successResponse(result));
  });

  app.patch("/tasks/:taskId", async (req: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const parsed = s.updateTaskSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.updateTask(req.tenantId!, req.userId!, req.params.taskId, parsed.data);
    return reply.send(successResponse(result));
  });

  app.post("/tasks/:taskId/move", async (req: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const parsed = s.moveTaskSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.moveTask(req.tenantId!, req.userId!, req.params.taskId, parsed.data);
    return reply.send(successResponse(result));
  });

  app.delete("/tasks/:taskId", async (req: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    await svc.deleteTask(req.tenantId!, req.userId!, req.params.taskId);
    return reply.send(successResponse({ message: "Task deleted" }));
  });

  // ═══════════════════════════════════════════════════════
  // COMMENTS
  // ═══════════════════════════════════════════════════════

  app.post("/tasks/:taskId/comments", async (req: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const parsed = s.createCommentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.createComment(req.tenantId!, req.userId!, req.params.taskId, parsed.data);
    return reply.status(201).send(successResponse(result));
  });

  app.get("/tasks/:taskId/comments", async (req: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const result = await svc.listComments(req.tenantId!, req.params.taskId);
    return reply.send(successResponse(result));
  });

  app.patch("/comments/:commentId", async (req: FastifyRequest<{ Params: { commentId: string } }>, reply: FastifyReply) => {
    const parsed = s.updateCommentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.updateComment(req.tenantId!, req.userId!, req.params.commentId, parsed.data);
    return reply.send(successResponse(result));
  });

  app.delete("/comments/:commentId", async (req: FastifyRequest<{ Params: { commentId: string } }>, reply: FastifyReply) => {
    await svc.deleteComment(req.tenantId!, req.userId!, req.params.commentId);
    return reply.send(successResponse({ message: "Comment deleted" }));
  });

  // ═══════════════════════════════════════════════════════
  // ATTACHMENTS
  // ═══════════════════════════════════════════════════════

  app.post("/tasks/:taskId/attachments", async (req: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const parsed = s.createAttachmentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await svc.createAttachment(req.tenantId!, req.userId!, req.params.taskId, parsed.data);
    return reply.status(201).send(successResponse(result));
  });

  app.get("/tasks/:taskId/attachments", async (req: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const result = await svc.listAttachments(req.tenantId!, req.params.taskId);
    return reply.send(successResponse(result));
  });

  app.delete("/attachments/:attachmentId", async (req: FastifyRequest<{ Params: { attachmentId: string } }>, reply: FastifyReply) => {
    await svc.deleteAttachment(req.tenantId!, req.params.attachmentId);
    return reply.send(successResponse({ message: "Attachment deleted" }));
  });

  // ═══════════════════════════════════════════════════════
  // ACTIVITY LOG
  // ═══════════════════════════════════════════════════════

  app.get("/tasks/:taskId/activity", async (req: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const result = await svc.getActivityLog(req.tenantId!, req.params.taskId);
    return reply.send(successResponse(result));
  });
}
