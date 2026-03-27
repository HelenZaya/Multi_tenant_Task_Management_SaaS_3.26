import { prisma } from "../lib/prisma.js";

export const cardRepository = {
  createCard(data: {
    tenantId: string;
    boardId: string;
    listId: string;
    title: string;
    description?: string | null;
    label?: string | null;
    deadline?: Date | null;
    assigneeId?: string | null;
    status: "TODO" | "IN_PROGRESS" | "DONE";
    actorId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const lastCard = await tx.card.findFirst({
        where: { tenantId: data.tenantId, listId: data.listId, deletedAt: null },
        orderBy: { position: "desc" }
      });
      return tx.card.create({
        data: {
          tenantId: data.tenantId,
          boardId: data.boardId,
          listId: data.listId,
          title: data.title,
          description: data.description,
          label: data.label,
          deadline: data.deadline,
          assigneeId: data.assigneeId,
          status: data.status,
          position: (Number(lastCard?.position ?? 0) + 1000).toFixed(4),
          createdBy: data.actorId,
          updatedBy: data.actorId
        }
      });
    });
  },
  findCard(tenantId: string, cardId: string) {
    return prisma.card.findFirst({ where: { id: cardId, tenantId, deletedAt: null } });
  },
  listCardsInList(tenantId: string, listId: string) {
    return prisma.card.findMany({
      where: { tenantId, listId, deletedAt: null },
      orderBy: { position: "asc" }
    });
  },
  updateCard(cardId: string, data: Record<string, unknown>) {
    return prisma.card.update({ where: { id: cardId }, data });
  }
};
