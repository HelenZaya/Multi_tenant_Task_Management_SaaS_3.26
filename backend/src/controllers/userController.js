import { prisma } from "../lib/prisma.js";

export async function getUsers(req, res) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId: req.user.organizationId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { role: "asc" },
  });
  res.json({
    users: memberships.map(m => ({ ...m.user, role: m.role })),
  });
}
