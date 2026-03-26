import createError from "http-errors";
import { prisma } from "../lib/prisma.js";
import { midValue } from "../utils/fractionalIndex.js";
import { emitBoardUpdated } from "../socket.js";

export async function moveCard(req, res, next) {
  try {
    const { sourceListId, targetListId, targetCardId } = req.body;
    const card = await prisma.card.findFirst({
      where: {
        id: req.params.cardId,
        organizationId: req.user.organizationId,
      },
    });
    if (!card) throw createError(404, "Card not found");

    const targetCard = await prisma.card.findFirst({
      where: {
        id: targetCardId,
        organizationId: req.user.organizationId,
      },
    });
    if (!targetCard) throw createError(404, "Target card not found");

    const siblings = await prisma.card.findMany({
      where: {
        listId: targetListId,
        organizationId: req.user.organizationId,
      },
      orderBy: { position: "asc" },
    });

    const targetIndex = siblings.findIndex(c => c.id === targetCard.id);
    const left = siblings[targetIndex - 1]?.position;
    const right = siblings[targetIndex]?.position;
    const position = midValue(left, right);

    const updated = await prisma.card.update({
      where: { id: card.id },
      data: {
        listId: targetListId,
        position,
      },
    });

    emitBoardUpdated(req.user.organizationId, card.boardId);
    res.json({ card: updated });
  } catch (err) {
    next(err);
  }
}
