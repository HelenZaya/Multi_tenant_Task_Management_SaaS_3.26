import { CardStatus, Role } from "@prisma/client";
import { z } from "zod";
export const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    tenantName: z.string().min(2),
    tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/)
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});
export const refreshSchema = z.object({
    refreshToken: z.string().min(1)
});
export const workspaceSchema = z.object({
    name: z.string().min(2)
});
export const boardSchema = z.object({
    name: z.string().min(2),
    workspaceId: z.string().min(1)
});
export const cardSchema = z.object({
    title: z.string().min(2),
    description: z.string().optional().nullable(),
    label: z.string().optional().nullable(),
    deadline: z.string().datetime().optional().nullable(),
    assigneeId: z.string().optional().nullable(),
    listId: z.string().min(1),
    boardId: z.string().min(1),
    status: z.nativeEnum(CardStatus).default(CardStatus.TODO)
});
export const moveCardSchema = z.object({
    targetListId: z.string().min(1),
    targetCardId: z.string().optional().nullable(),
    position: z.string().optional().nullable()
});
export const inviteSchema = z.object({
    email: z.string().email(),
    role: z.nativeEnum(Role),
    name: z.string().min(2).optional()
});
