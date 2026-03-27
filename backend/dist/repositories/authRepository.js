import { prisma } from "../lib/prisma.js";
export const authRepository = {
    findUserByEmail(email) {
        return prisma.user.findFirst({
            where: { email, deletedAt: null },
            include: {
                memberships: {
                    where: { deletedAt: null, tenant: { deletedAt: null } },
                    include: { tenant: true }
                }
            }
        });
    },
    findUserById(userId) {
        return prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: {
                memberships: {
                    where: { deletedAt: null },
                    include: { tenant: true }
                }
            }
        });
    },
    async createTenantWithAdmin(data) {
        return prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: data.name,
                    email: data.email,
                    passwordHash: data.passwordHash
                }
            });
            const tenant = await tx.tenant.create({ data: { name: data.tenantName, slug: data.tenantSlug } });
            await tx.membership.create({
                data: {
                    userId: user.id,
                    tenantId: tenant.id,
                    role: "ADMIN",
                    createdBy: user.id,
                    updatedBy: user.id
                }
            });
            const workspace = await tx.workspace.create({
                data: {
                    name: `${data.tenantName} Workspace`,
                    tenantId: tenant.id,
                    createdBy: user.id,
                    updatedBy: user.id
                }
            });
            const board = await tx.board.create({
                data: {
                    name: "Getting Started",
                    tenantId: tenant.id,
                    workspaceId: workspace.id,
                    createdBy: user.id,
                    updatedBy: user.id
                }
            });
            await tx.list.createMany({
                data: [
                    { tenantId: tenant.id, boardId: board.id, name: "Backlog", position: "1000", createdBy: user.id, updatedBy: user.id },
                    { tenantId: tenant.id, boardId: board.id, name: "In Progress", position: "2000", createdBy: user.id, updatedBy: user.id },
                    { tenantId: tenant.id, boardId: board.id, name: "Done", position: "3000", createdBy: user.id, updatedBy: user.id }
                ]
            });
            return { user, tenant };
        });
    },
    createRefreshToken(data) {
        return prisma.refreshToken.create({ data });
    },
    findRefreshToken(jti) {
        return prisma.refreshToken.findUnique({ where: { jti } });
    },
    revokeRefreshToken(jti, replacedById) {
        return prisma.refreshToken.update({
            where: { jti },
            data: { revokedAt: new Date(), replacedById }
        });
    },
    writeAuditLog(tenantId, actorId, action, entityType, entityId, payload) {
        return prisma.auditLog.create({
            data: { tenantId, actorId: actorId ?? undefined, action, entityType, entityId, payload }
        });
    },
    createInvitationMembership(data) {
        return prisma.membership.upsert({
            where: { tenantId_userId: { tenantId: data.tenantId, userId: data.userId } },
            update: { role: data.role, invitedById: data.invitedById, updatedBy: data.invitedById, deletedAt: null },
            create: {
                tenantId: data.tenantId,
                userId: data.userId,
                role: data.role,
                invitedById: data.invitedById,
                createdBy: data.invitedById,
                updatedBy: data.invitedById
            }
        });
    }
};
