import bcrypt from "bcryptjs";
import { CardStatus, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "zenith-demo" },
    update: {},
    create: { name: "Zenith Demo", slug: "zenith-demo" },
  });

  const users = await Promise.all(
    [
      ["Admin User", "admin@zenith.local", Role.ADMIN],
      ["Member User", "member@zenith.local", Role.MEMBER],
      ["Viewer User", "viewer@zenith.local", Role.VIEWER],
    ].map(async ([name, email, role]) => {
      const user = await prisma.user.upsert({
        where: { email },
        update: { name },
        create: { name, email, passwordHash },
      });

      await prisma.membership.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
        update: { role: role as Role },
        create: {
          tenantId: tenant.id,
          userId: user.id,
          role: role as Role,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      return user;
    }),
  );

  const [admin, member] = users;

  const workspace = await prisma.workspace.upsert({
    where: { id: "zenith-workspace" },
    update: { tenantId: tenant.id, name: "Operations Workspace" },
    create: {
      id: "zenith-workspace",
      tenantId: tenant.id,
      name: "Operations Workspace",
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  const board = await prisma.board.upsert({
    where: { id: "zenith-board" },
    update: { tenantId: tenant.id, workspaceId: workspace.id, name: "Q2 Delivery Board" },
    create: {
      id: "zenith-board",
      tenantId: tenant.id,
      workspaceId: workspace.id,
      name: "Q2 Delivery Board",
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  const lists = await Promise.all(
    [
      ["list-backlog", "Backlog", "1000"],
      ["list-progress", "In Progress", "2000"],
      ["list-review", "Review", "3000"],
      ["list-done", "Done", "4000"],
    ].map(([id, name, position]) =>
      prisma.list.upsert({
        where: { id },
        update: { tenantId: tenant.id, boardId: board.id, name, position },
        create: {
          id,
          tenantId: tenant.id,
          boardId: board.id,
          name,
          position,
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      }),
    ),
  );

  const [backlog, progress, review, done] = lists;

  const cards = [
    {
      id: "card-1",
      title: "Deploy gateway rate limiting",
      description: "Configure request throttling and proxy headers for the API gateway.",
      label: "Platform",
      deadline: new Date(Date.now() + 86400000),
      status: CardStatus.TODO,
      position: "1000",
      listId: backlog.id,
      assigneeId: admin.id,
    },
    {
      id: "card-2",
      title: "Real-time board sync",
      description: "Wire Socket.IO updates into optimistic card movement.",
      label: "Realtime",
      deadline: new Date(Date.now() + 2 * 86400000),
      status: CardStatus.IN_PROGRESS,
      position: "1000",
      listId: progress.id,
      assigneeId: member.id,
    },
    {
      id: "card-3",
      title: "Quarterly report export",
      description: "Generate workspace summary report from the read model.",
      label: "Reporting",
      deadline: new Date(Date.now() + 3 * 86400000),
      status: CardStatus.TODO,
      position: "1000",
      listId: review.id,
      assigneeId: admin.id,
    },
    {
      id: "card-4",
      title: "Prisma schema hardening",
      description: "Add soft-delete fields and tenant indexes to critical tables.",
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
      update: {
        tenantId: tenant.id,
        boardId: board.id,
        ...card,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      create: {
        tenantId: tenant.id,
        boardId: board.id,
        ...card,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
