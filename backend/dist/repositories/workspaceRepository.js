import { prisma } from "../lib/prisma.js";
export const workspaceRepository = {
    listWorkspaces(tenantId) {
        return prisma.workspace.findMany({
            where: { tenantId, deletedAt: null },
            orderBy: { createdAt: "asc" }
        });
    },
    createWorkspace(tenantId, name, actorId) {
        return prisma.workspace.create({
            data: { tenantId, name, createdBy: actorId, updatedBy: actorId }
        });
    }
};
