import { prisma } from "../lib/prisma.js";

export async function getSummary(req, res) {
  const organizationId = req.user.organizationId;
  const [organizations, boards, totalCards, doneCards, overdueCards] = await Promise.all([
    prisma.organization.count({ where: { id: organizationId } }),
    prisma.board.count({ where: { workspace: { organizationId } } }),
    prisma.card.count({ where: { organizationId } }),
    prisma.card.count({ where: { organizationId, status: "DONE" } }),
    prisma.card.count({ where: { organizationId, deadline: { lt: new Date() }, status: { not: "DONE" } } }),
  ]);

  const completionRate = totalCards ? Math.round((doneCards / totalCards) * 100) : 0;
  res.json({ organizations, boards, completionRate, overdueCards });
}
