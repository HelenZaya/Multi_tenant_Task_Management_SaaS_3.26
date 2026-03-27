import { prisma } from "../lib/prisma.js";

export async function getBoards(req, res) {
  const boards = await prisma.board.findMany({
    where: { workspace: { organizationId: req.user.organizationId } },
    include: {
      workspace: true,
      lists: { orderBy: { position: "asc" } },
      _count: { select: { cards: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ boards });
}

export async function getBoard(req, res) {
  const board = await prisma.board.findFirst({
    where: {
      id: req.params.boardId,
      workspace: { organizationId: req.user.organizationId },
    },
    include: {
      workspace: true,
      lists: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            orderBy: { position: "asc" },
            include: { assignee: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  res.json({ board });
}
