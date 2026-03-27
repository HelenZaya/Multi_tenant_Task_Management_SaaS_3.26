import { prisma } from "../lib/prisma.js";

export const boardRepository = {
  listBoards(tenantId: string) {
    return prisma.board.findMany({
      where: { tenantId, deletedAt: null, workspace: { deletedAt: null } },
      include: {
        workspace: true,
        lists: { where: { deletedAt: null }, orderBy: { position: "asc" } },
        _count: { select: { cards: { where: { deletedAt: null } } } }
      },
      orderBy: { createdAt: "desc" }
    });
  },
  getBoard(tenantId: string, boardId: string) {
    return prisma.board.findFirst({
      where: { id: boardId, tenantId, deletedAt: null },
      include: {
        workspace: true,
        lists: {
          where: { deletedAt: null },
          orderBy: { position: "asc" },
          include: {
            cards: {
              where: { deletedAt: null },
              orderBy: { position: "asc" },
              include: { assignee: { select: { id: true, name: true, email: true } } }
            }
          }
        }
      }
    });
  },
  createBoard(tenantId: string, workspaceId: string, name: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: { tenantId, workspaceId, name, createdBy: actorId, updatedBy: actorId }
      });
      await tx.list.createMany({
        data: [
          { tenantId, boardId: board.id, name: "Backlog", position: "1000", createdBy: actorId, updatedBy: actorId },
          { tenantId, boardId: board.id, name: "In Progress", position: "2000", createdBy: actorId, updatedBy: actorId },
          { tenantId, boardId: board.id, name: "Done", position: "3000", createdBy: actorId, updatedBy: actorId }
        ]
      });
      return board;
    });
  },
  dashboardSummary(tenantId: string) {
    return Promise.all([
      prisma.workspace.count({ where: { tenantId, deletedAt: null } }),
      prisma.board.count({ where: { tenantId, deletedAt: null } }),
      prisma.card.count({ where: { tenantId, deletedAt: null } }),
      prisma.card.count({ where: { tenantId, deletedAt: null, status: "DONE" } }),
      prisma.card.count({
        where: {
          tenantId,
          deletedAt: null,
          deadline: { lt: new Date() },
          status: { not: "DONE" }
        }
      })
    ]);
  }
};
