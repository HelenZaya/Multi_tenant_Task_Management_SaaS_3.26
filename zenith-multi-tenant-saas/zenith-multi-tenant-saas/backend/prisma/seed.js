import bcrypt from "bcryptjs";
import { PrismaClient, Role, CardStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const [admin, member, viewer] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@zenith.local" },
      update: {},
      create: { name: "Admin User", email: "admin@zenith.local", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "member@zenith.local" },
      update: {},
      create: { name: "Member User", email: "member@zenith.local", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "viewer@zenith.local" },
      update: {},
      create: { name: "Viewer User", email: "viewer@zenith.local", passwordHash },
    }),
  ]);

  const org = await prisma.organization.upsert({
    where: { id: "zenith-org" },
    update: {},
    create: { id: "zenith-org", name: "Zenith Demo Org" },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: admin.id, organizationId: org.id } },
    update: { role: Role.ADMIN },
    create: { userId: admin.id, organizationId: org.id, role: Role.ADMIN },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: member.id, organizationId: org.id } },
    update: { role: Role.MEMBER },
    create: { userId: member.id, organizationId: org.id, role: Role.MEMBER },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: viewer.id, organizationId: org.id } },
    update: { role: Role.VIEWER },
    create: { userId: viewer.id, organizationId: org.id, role: Role.VIEWER },
  });

  const workspace = await prisma.workspace.upsert({
    where: { id: "zenith-workspace" },
    update: {},
    create: { id: "zenith-workspace", name: "Zenith Workspace", organizationId: org.id },
  });

  const board = await prisma.board.upsert({
    where: { id: "zenith-board" },
    update: {},
    create: { id: "zenith-board", name: "Launch Sprint", workspaceId: workspace.id },
  });

  const todo = await prisma.list.upsert({
    where: { id: "list-todo" },
    update: {},
    create: { id: "list-todo", name: "Todo", boardId: board.id, position: "1000" },
  });
  const doing = await prisma.list.upsert({
    where: { id: "list-doing" },
    update: {},
    create: { id: "list-doing", name: "Doing", boardId: board.id, position: "2000" },
  });
  const done = await prisma.list.upsert({
    where: { id: "list-done" },
    update: {},
    create: { id: "list-done", name: "Done", boardId: board.id, position: "3000" },
  });

  const cards = [
    {
      id: "card-1",
      title: "Finalize product brief",
      description: "Write scope, goals, and milestone plan.",
      label: "Planning",
      deadline: new Date(Date.now() + 86400000),
      status: CardStatus.TODO,
      position: "1000",
      listId: todo.id,
      assigneeId: admin.id,
    },
    {
      id: "card-2",
      title: "Design dashboard widgets",
      description: "Completion rate and overdue widgets in dark UI.",
      label: "Design",
      deadline: new Date(Date.now() + 2 * 86400000),
      status: CardStatus.IN_PROGRESS,
      position: "1000",
      listId: doing.id,
      assigneeId: member.id,
    },
    {
      id: "card-3",
      title: "Set up Prisma schema",
      description: "Tenant-aware schema and indices for boards/cards.",
      label: "Backend",
      deadline: new Date(Date.now() - 86400000),
      status: CardStatus.DONE,
      position: "1000",
      listId: done.id,
      assigneeId: admin.id,
    },
  ];

  for (const card of cards) {
    await prisma.card.upsert({
      where: { id: card.id },
      update: {},
      create: {
        ...card,
        boardId: board.id,
        organizationId: org.id,
      },
    });
  }
}

main().finally(() => prisma.$disconnect());
