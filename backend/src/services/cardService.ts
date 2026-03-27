import createError from "http-errors";
import { cacheKeys, invalidateCache } from "../lib/cache.js";
import { publishDomainEvent } from "../lib/events.js";
import { deadlineQueue } from "../lib/queue.js";
import { broadcastTenantEvent } from "../lib/socket.js";
import { cardRepository } from "../repositories/cardRepository.js";
import { midValue } from "../utils/fractionalIndex.js";

export const cardService = {
  async createCard(input: {
    tenantId: string;
    boardId: string;
    listId: string;
    title: string;
    description?: string | null;
    label?: string | null;
    deadline?: string | null;
    assigneeId?: string | null;
    status: "TODO" | "IN_PROGRESS" | "DONE";
    actorId: string;
  }) {
    const card = await cardRepository.createCard({
      ...input,
      deadline: input.deadline ? new Date(input.deadline) : null
    });
    if (card.deadline) {
      await deadlineQueue.add("deadline.reminder", { tenantId: input.tenantId, cardId: card.id, deadline: card.deadline.toISOString() }, { delay: Math.max(card.deadline.getTime() - Date.now() - 3600000, 1000) });
    }
    await invalidateCache([cacheKeys.board(input.tenantId, input.boardId), cacheKeys.dashboard(input.tenantId)]);
    await publishDomainEvent(input.tenantId, "card.created", { boardId: input.boardId, cardId: card.id });
    broadcastTenantEvent(input.tenantId, "card.created", { boardId: input.boardId, card });
    return card;
  },

  async moveCard(input: { tenantId: string; cardId: string; targetListId: string; targetCardId?: string | null; actorId: string }) {
    const card = await cardRepository.findCard(input.tenantId, input.cardId);
    if (!card) throw createError(404, "Card not found");

    const siblings = await cardRepository.listCardsInList(input.tenantId, input.targetListId);
    const targetIndex = input.targetCardId ? siblings.findIndex((item) => item.id === input.targetCardId) : siblings.length;
    const left = siblings[targetIndex - 1]?.position;
    const right = siblings[targetIndex]?.position;
    const position = midValue(left?.toString(), right?.toString());

    const updated = await cardRepository.updateCard(card.id, {
      listId: input.targetListId,
      position,
      updatedBy: input.actorId,
      updatedAt: new Date()
    });

    await invalidateCache([cacheKeys.board(input.tenantId, card.boardId), cacheKeys.dashboard(input.tenantId)]);
    await publishDomainEvent(input.tenantId, "card.moved", { boardId: card.boardId, cardId: card.id, listId: input.targetListId });
    broadcastTenantEvent(input.tenantId, "board.updated", { boardId: card.boardId, cardId: card.id, listId: input.targetListId });
    return updated;
  }
};
