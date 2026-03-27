import { prisma } from "../lib/prisma.js";

export const workspaceRepository = {
  listWorkspaces(tenantId: string) {
    return prisma.workspace.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });
  },
  createWorkspace(tenantId: string, name: string, actorId: string) {
    return prisma.workspace.create({
      data: { tenantId, name, createdBy: actorId, updatedBy: actorId }
    });
  }
};
