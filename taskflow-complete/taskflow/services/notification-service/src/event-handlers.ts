import { subscribe, queryWithTenant } from "@taskflow/db";
import { createLogger, type DomainEvent, DOMAIN_EVENTS } from "@taskflow/utils";
import { createNotification } from "./service.js";

const logger = createLogger("notification-service:events");

/**
 * Maps domain events to notification creation.
 * Subscribes to Redis pub/sub channel "domain.events" and
 * dispatches to appropriate handler based on event type.
 */
export async function startEventListeners(redisUrl: string): Promise<void> {
  logger.info("Starting domain event listeners...");

  await subscribe(redisUrl, "domain.events", async (message: unknown) => {
    const event = message as DomainEvent;

    try {
      switch (event.type) {
        case DOMAIN_EVENTS.TASK_CREATED:
          await handleTaskCreated(event);
          break;

        case DOMAIN_EVENTS.TASK_UPDATED:
          await handleTaskUpdated(event);
          break;

        case DOMAIN_EVENTS.TASK_MOVED:
          await handleTaskMoved(event);
          break;

        case DOMAIN_EVENTS.COMMENT_ADDED:
          await handleCommentAdded(event);
          break;

        case DOMAIN_EVENTS.USER_INVITED:
          await handleUserInvited(event);
          break;

        case DOMAIN_EVENTS.MEMBER_ADDED:
          await handleMemberAdded(event);
          break;

        default:
          logger.debug({ type: event.type }, "Unhandled event type");
      }
    } catch (err) {
      logger.error({ err, eventType: event.type, eventId: event.id }, "Failed to handle domain event");
    }
  });

  logger.info("Domain event listeners started");
}

// ─── Event Handlers ─────────────────────────────────────────

async function handleTaskCreated(event: DomainEvent): Promise<void> {
  const payload = event.payload as {
    taskId: string;
    projectId: string;
    title: string;
  };

  // Notify all project members except the creator
  const members = await getProjectMembersExcept(
    event.tenantId,
    payload.projectId,
    event.userId
  );

  for (const member of members) {
    await createNotification(event.tenantId, {
      userId: member.user_id,
      type: "task.created",
      title: "New task created",
      body: `"${payload.title}" was created in your project`,
      data: {
        taskId: payload.taskId,
        projectId: payload.projectId,
        createdBy: event.userId,
      },
    });
  }

  logger.info({ taskId: payload.taskId, notified: members.length }, "Task created notifications sent");
}

async function handleTaskUpdated(event: DomainEvent): Promise<void> {
  const payload = event.payload as {
    taskId: string;
    projectId: string;
    changes: Record<string, { from: unknown; to: unknown }>;
  };

  // If assignee changed, notify the new assignee
  if (payload.changes["assignee_id"]) {
    const newAssigneeId = payload.changes["assignee_id"].to as string;
    if (newAssigneeId && newAssigneeId !== event.userId) {
      await createNotification(event.tenantId, {
        userId: newAssigneeId,
        type: "task.assigned",
        title: "Task assigned to you",
        body: `You have been assigned a task`,
        data: {
          taskId: payload.taskId,
          projectId: payload.projectId,
          assignedBy: event.userId,
        },
      });
    }
  }

  // If status changed to done, notify reporter
  if (payload.changes["status"]?.to === "done") {
    // Get the task's reporter
    const { rows } = await queryWithTenant(
      event.tenantId,
      "SELECT reporter_id FROM tasks WHERE id = $1",
      [payload.taskId]
    );
    const reporterId = rows[0]?.reporter_id;
    if (reporterId && reporterId !== event.userId) {
      await createNotification(event.tenantId, {
        userId: reporterId,
        type: "task.completed",
        title: "Task completed",
        body: `A task you reported has been marked as done`,
        data: {
          taskId: payload.taskId,
          projectId: payload.projectId,
          completedBy: event.userId,
        },
      });
    }
  }
}

async function handleTaskMoved(event: DomainEvent): Promise<void> {
  const payload = event.payload as {
    taskId: string;
    projectId: string;
    fromColumnId: string;
    toColumnId: string;
  };

  // Notify task assignee if they didn't move it themselves
  const { rows } = await queryWithTenant(
    event.tenantId,
    "SELECT assignee_id, title FROM tasks WHERE id = $1",
    [payload.taskId]
  );
  const task = rows[0];
  if (task?.assignee_id && task.assignee_id !== event.userId) {
    // Get column names
    const { rows: cols } = await queryWithTenant(
      event.tenantId,
      "SELECT id, name FROM columns WHERE id IN ($1, $2)",
      [payload.fromColumnId, payload.toColumnId]
    );
    const fromCol = cols.find((c: Record<string, unknown>) => c.id === payload.fromColumnId);
    const toCol = cols.find((c: Record<string, unknown>) => c.id === payload.toColumnId);

    await createNotification(event.tenantId, {
      userId: task.assignee_id,
      type: "task.moved",
      title: "Task moved",
      body: `"${task.title}" moved from ${fromCol?.name ?? "?"} to ${toCol?.name ?? "?"}`,
      data: {
        taskId: payload.taskId,
        projectId: payload.projectId,
        movedBy: event.userId,
      },
    });
  }
}

async function handleCommentAdded(event: DomainEvent): Promise<void> {
  const payload = event.payload as {
    commentId: string;
    taskId: string;
    projectId: string;
    content: string;
  };

  // Notify task assignee and reporter
  const { rows } = await queryWithTenant(
    event.tenantId,
    "SELECT assignee_id, reporter_id, title FROM tasks WHERE id = $1",
    [payload.taskId]
  );
  const task = rows[0];
  if (!task) return;

  const notifyUserIds = new Set<string>();
  if (task.assignee_id && task.assignee_id !== event.userId) {
    notifyUserIds.add(task.assignee_id);
  }
  if (task.reporter_id && task.reporter_id !== event.userId) {
    notifyUserIds.add(task.reporter_id);
  }

  const preview = payload.content.length > 100
    ? payload.content.slice(0, 97) + "..."
    : payload.content;

  for (const uid of notifyUserIds) {
    await createNotification(event.tenantId, {
      userId: uid,
      type: "comment.added",
      title: `New comment on "${task.title}"`,
      body: preview,
      data: {
        commentId: payload.commentId,
        taskId: payload.taskId,
        projectId: payload.projectId,
        commentedBy: event.userId,
      },
    });
  }
}

async function handleUserInvited(event: DomainEvent): Promise<void> {
  const payload = event.payload as {
    email: string;
    role: string;
    inviteCode: string;
    membershipId: string;
  };

  // This is where you'd send an email in production
  // For now, log the invite details
  logger.info(
    {
      tenantId: event.tenantId,
      email: payload.email,
      role: payload.role,
      inviteCode: payload.inviteCode,
    },
    "User invited — email would be sent here"
  );

  // TODO: Queue email job via worker service
  // await publish("worker.jobs", {
  //   type: "send_invite_email",
  //   tenantId: event.tenantId,
  //   email: payload.email,
  //   inviteCode: payload.inviteCode,
  //   role: payload.role,
  // });
}

async function handleMemberAdded(event: DomainEvent): Promise<void> {
  const payload = event.payload as {
    projectId: string;
    addedUserId: string;
    role: string;
  };

  if (payload.addedUserId !== event.userId) {
    // Get project name
    const { rows } = await queryWithTenant(
      event.tenantId,
      "SELECT name FROM projects WHERE id = $1",
      [payload.projectId]
    );
    const projectName = rows[0]?.name ?? "a project";

    await createNotification(event.tenantId, {
      userId: payload.addedUserId,
      type: "project.member_added",
      title: `Added to project "${projectName}"`,
      body: `You've been added as ${payload.role}`,
      data: {
        projectId: payload.projectId,
        addedBy: event.userId,
        role: payload.role,
      },
    });
  }
}

// ─── Helper ─────────────────────────────────────────────────

async function getProjectMembersExcept(
  tenantId: string,
  projectId: string,
  excludeUserId: string
): Promise<Array<{ user_id: string }>> {
  const { rows } = await queryWithTenant<{ user_id: string }>(
    tenantId,
    `SELECT user_id FROM project_members
     WHERE project_id = $1 AND user_id != $2`,
    [projectId, excludeUserId]
  );
  return rows;
}
