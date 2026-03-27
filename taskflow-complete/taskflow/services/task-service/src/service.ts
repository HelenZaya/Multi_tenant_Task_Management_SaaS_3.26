import {
  queryWithTenant,
  publish,
} from "@taskflow/db";
import {
  generateId,
  NotFoundError,
  createLogger,
  DOMAIN_EVENTS,
  type DomainEvent,
} from "@taskflow/utils";
import { generateRank, needsRebalance } from "./lexorank.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  ListTasksQuery,
  CreateCommentInput,
  UpdateCommentInput,
  CreateAttachmentInput,
  CreateBoardInput,
  UpdateBoardInput,
  CreateColumnInput,
  UpdateColumnInput,
  MoveColumnInput,
} from "./schemas.js";

const logger = createLogger("task-service:service");

// ═══════════════════════════════════════════════════════════
// BOARDS
// ═══════════════════════════════════════════════════════════

export async function createBoard(
  tenantId: string,
  _userId: string,
  input: CreateBoardInput
) {
  // Get last board position
  const { rows: last } = await queryWithTenant(
    tenantId,
    `SELECT position FROM boards
     WHERE project_id = $1 AND deleted_at IS NULL
     ORDER BY position DESC LIMIT 1`,
    [input.projectId]
  );
  const position = generateRank({
    before: last[0]?.position ?? null,
    after: null,
  });

  const boardId = generateId();
  const { rows } = await queryWithTenant(
    tenantId,
    `INSERT INTO boards (id, tenant_id, project_id, name, position)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, project_id, name, position, created_at`,
    [boardId, tenantId, input.projectId, input.name, position]
  );

  logger.info({ tenantId, boardId }, "Board created");
  return rows[0];
}

export async function updateBoard(
  tenantId: string,
  boardId: string,
  input: UpdateBoardInput
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    values.push(input.name);
  }
  if (setClauses.length === 0) return getBoard(tenantId, boardId);

  values.push(boardId);
  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE boards SET ${setClauses.join(", ")}, updated_at = NOW()
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING id, project_id, name, position, created_at, updated_at`,
    values
  );
  if (rows.length === 0) throw new NotFoundError("Board", boardId);
  return rows[0];
}

export async function getBoard(tenantId: string, boardId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT id, project_id, name, position, created_at, updated_at
     FROM boards WHERE id = $1 AND deleted_at IS NULL`,
    [boardId]
  );
  if (rows.length === 0) throw new NotFoundError("Board", boardId);
  return rows[0]!;
}

export async function deleteBoard(tenantId: string, boardId: string) {
  const { rowCount } = await queryWithTenant(
    tenantId,
    "UPDATE boards SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    [boardId]
  );
  if (rowCount === 0) throw new NotFoundError("Board", boardId);
}

// ═══════════════════════════════════════════════════════════
// COLUMNS
// ═══════════════════════════════════════════════════════════

export async function createColumn(
  tenantId: string,
  _userId: string,
  input: CreateColumnInput
) {
  const { rows: last } = await queryWithTenant(
    tenantId,
    `SELECT position FROM columns
     WHERE board_id = $1 AND deleted_at IS NULL
     ORDER BY position DESC LIMIT 1`,
    [input.boardId]
  );
  const position = generateRank({
    before: last[0]?.position ?? null,
    after: null,
  });

  const colId = generateId();
  const { rows } = await queryWithTenant(
    tenantId,
    `INSERT INTO columns (id, tenant_id, board_id, name, position, color, wip_limit)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, board_id, name, position, color, wip_limit, created_at`,
    [colId, tenantId, input.boardId, input.name, position, input.color ?? "#6366f1", input.wipLimit ?? null]
  );

  logger.info({ tenantId, columnId: colId }, "Column created");
  return rows[0];
}

export async function updateColumn(
  tenantId: string,
  columnId: string,
  input: UpdateColumnInput
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(input.name); }
  if (input.color !== undefined) { setClauses.push(`color = $${idx++}`); values.push(input.color); }
  if (input.wipLimit !== undefined) { setClauses.push(`wip_limit = $${idx++}`); values.push(input.wipLimit); }

  if (setClauses.length === 0) return;

  values.push(columnId);
  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE columns SET ${setClauses.join(", ")}, updated_at = NOW()
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING id, board_id, name, position, color, wip_limit, updated_at`,
    values
  );
  if (rows.length === 0) throw new NotFoundError("Column", columnId);
  return rows[0];
}

export async function moveColumn(
  tenantId: string,
  columnId: string,
  input: MoveColumnInput
) {
  const position = generateRank({
    before: input.beforePosition ?? null,
    after: input.afterPosition ?? null,
  });

  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE columns SET position = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, board_id, name, position`,
    [position, columnId]
  );
  if (rows.length === 0) throw new NotFoundError("Column", columnId);
  return rows[0];
}

export async function deleteColumn(tenantId: string, columnId: string) {
  const { rowCount } = await queryWithTenant(
    tenantId,
    "UPDATE columns SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    [columnId]
  );
  if (rowCount === 0) throw new NotFoundError("Column", columnId);
}

// ═══════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════

export async function createTask(
  tenantId: string,
  userId: string,
  input: CreateTaskInput
) {
  const position = generateRank({
    before: input.beforePosition ?? null,
    after: input.afterPosition ?? null,
  });

  const taskId = generateId();
  const { rows } = await queryWithTenant(
    tenantId,
    `INSERT INTO tasks
       (id, tenant_id, project_id, column_id, title, description, status, priority,
        position, assignee_id, reporter_id, due_date, estimated_hours, tags)
     VALUES ($1,$2,$3,$4,$5,$6,'todo',$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      taskId, tenantId, input.projectId, input.columnId, input.title,
      input.description ?? null, input.priority, position,
      input.assigneeId ?? null, userId,
      input.dueDate ? new Date(input.dueDate) : null,
      input.estimatedHours ?? null,
      input.tags ?? [],
    ]
  );

  // Activity log
  await logActivity(tenantId, input.projectId, taskId, userId, "created", "task", taskId, {});

  // Domain event
  const event: DomainEvent = {
    id: generateId(),
    type: DOMAIN_EVENTS.TASK_CREATED,
    tenantId,
    userId,
    payload: { taskId, projectId: input.projectId, title: input.title },
    timestamp: new Date().toISOString(),
  };
  await publish("domain.events", event);

  if (needsRebalance(position)) {
    await publish("worker.jobs", {
      type: "rebalance_lexorank",
      tenantId,
      projectId: input.projectId,
      columnId: input.columnId,
    });
  }

  logger.info({ tenantId, taskId }, "Task created");
  return rows[0];
}

export async function getTask(tenantId: string, taskId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT t.*,
            a.full_name AS assignee_name, a.email AS assignee_email,
            r.full_name AS reporter_name, r.email AS reporter_email,
            c.name AS column_name
     FROM tasks t
     LEFT JOIN users a ON a.id = t.assignee_id
     LEFT JOIN users r ON r.id = t.reporter_id
     LEFT JOIN columns c ON c.id = t.column_id
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [taskId]
  );
  if (rows.length === 0) throw new NotFoundError("Task", taskId);
  return rows[0]!;
}

export async function listTasks(tenantId: string, queryParams: ListTasksQuery) {
  const { projectId, columnId, status, assigneeId, priority, search, page, limit } = queryParams;
  const offset = (page - 1) * limit;

  const conditions: string[] = ["t.project_id = $1", "t.deleted_at IS NULL"];
  const values: unknown[] = [projectId];
  let idx = 2;

  if (columnId) { conditions.push(`t.column_id = $${idx++}`); values.push(columnId); }
  if (status) { conditions.push(`t.status = $${idx++}`); values.push(status); }
  if (assigneeId) { conditions.push(`t.assignee_id = $${idx++}`); values.push(assigneeId); }
  if (priority) { conditions.push(`t.priority = $${idx++}`); values.push(priority); }
  if (search) { conditions.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`); values.push(`%${search}%`); idx++; }

  const where = conditions.join(" AND ");

  const { rows: countRows } = await queryWithTenant(
    tenantId,
    `SELECT COUNT(*)::int AS total FROM tasks t WHERE ${where}`,
    values
  );

  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT t.id, t.title, t.status, t.priority, t.position, t.column_id,
            t.assignee_id, t.due_date, t.tags, t.created_at, t.updated_at,
            a.full_name AS assignee_name, c.name AS column_name
     FROM tasks t
     LEFT JOIN users a ON a.id = t.assignee_id
     LEFT JOIN columns c ON c.id = t.column_id
     WHERE ${where}
     ORDER BY t.position ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  return { tasks: rows, total: countRows[0]?.total ?? 0, page, limit };
}

export async function updateTask(
  tenantId: string,
  userId: string,
  taskId: string,
  input: UpdateTaskInput
) {
  // Get current task for change tracking
  const current = await getTask(tenantId, taskId);

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  const fields: [keyof UpdateTaskInput, string][] = [
    ["title", "title"], ["description", "description"], ["priority", "priority"],
    ["status", "status"], ["assigneeId", "assignee_id"],
    ["estimatedHours", "estimated_hours"], ["actualHours", "actual_hours"],
  ];

  for (const [inputKey, dbCol] of fields) {
    if (input[inputKey] !== undefined) {
      setClauses.push(`${dbCol} = $${idx++}`);
      values.push(input[inputKey]);
      changes[dbCol] = { from: current[dbCol], to: input[inputKey] };
    }
  }

  if (input.dueDate !== undefined) {
    setClauses.push(`due_date = $${idx++}`);
    values.push(input.dueDate ? new Date(input.dueDate) : null);
    changes["due_date"] = { from: current.due_date, to: input.dueDate };
  }
  if (input.tags !== undefined) {
    setClauses.push(`tags = $${idx++}`);
    values.push(input.tags);
    changes["tags"] = { from: current.tags, to: input.tags };
  }

  if (setClauses.length === 0) return current;

  values.push(taskId);
  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE tasks SET ${setClauses.join(", ")}, updated_at = NOW()
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING *`,
    values
  );
  if (rows.length === 0) throw new NotFoundError("Task", taskId);

  // Activity log
  await logActivity(tenantId, current.project_id, taskId, userId, "updated", "task", taskId, changes);

  // Domain event
  const event: DomainEvent = {
    id: generateId(),
    type: DOMAIN_EVENTS.TASK_UPDATED,
    tenantId, userId,
    payload: { taskId, projectId: current.project_id, changes },
    timestamp: new Date().toISOString(),
  };
  await publish("domain.events", event);

  return rows[0];
}

export async function moveTask(
  tenantId: string,
  userId: string,
  taskId: string,
  input: MoveTaskInput
) {
  const current = await getTask(tenantId, taskId);
  const position = generateRank({
    before: input.beforePosition ?? null,
    after: input.afterPosition ?? null,
  });

  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE tasks SET column_id = $1, position = $2, updated_at = NOW()
     WHERE id = $3 AND deleted_at IS NULL
     RETURNING id, column_id, position, status`,
    [input.columnId, position, taskId]
  );
  if (rows.length === 0) throw new NotFoundError("Task", taskId);

  const changes = {
    column_id: { from: current.column_id, to: input.columnId },
    position: { from: current.position, to: position },
  };

  await logActivity(tenantId, current.project_id, taskId, userId, "moved", "task", taskId, changes);

  const event: DomainEvent = {
    id: generateId(),
    type: DOMAIN_EVENTS.TASK_MOVED,
    tenantId, userId,
    payload: {
      taskId,
      projectId: current.project_id,
      fromColumnId: current.column_id,
      toColumnId: input.columnId,
    },
    timestamp: new Date().toISOString(),
  };
  await publish("domain.events", event);

  if (needsRebalance(position)) {
    await publish("worker.jobs", {
      type: "rebalance_lexorank",
      tenantId,
      projectId: current.project_id,
      columnId: input.columnId,
    });
  }

  return rows[0];
}

export async function deleteTask(tenantId: string, userId: string, taskId: string) {
  const current = await getTask(tenantId, taskId);
  const { rowCount } = await queryWithTenant(
    tenantId,
    "UPDATE tasks SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    [taskId]
  );
  if (rowCount === 0) throw new NotFoundError("Task", taskId);

  await logActivity(tenantId, current.project_id, taskId, userId, "deleted", "task", taskId, {});

  const event: DomainEvent = {
    id: generateId(),
    type: DOMAIN_EVENTS.TASK_DELETED,
    tenantId, userId,
    payload: { taskId, projectId: current.project_id },
    timestamp: new Date().toISOString(),
  };
  await publish("domain.events", event);
}

// ═══════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════

export async function createComment(
  tenantId: string,
  userId: string,
  taskId: string,
  input: CreateCommentInput
) {
  // Verify task exists
  const task = await getTask(tenantId, taskId);

  const commentId = generateId();
  const { rows } = await queryWithTenant(
    tenantId,
    `INSERT INTO comments (id, tenant_id, task_id, user_id, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, task_id, user_id, content, created_at`,
    [commentId, tenantId, taskId, userId, input.content]
  );

  await logActivity(tenantId, task.project_id, taskId, userId, "commented", "comment", commentId, {});

  const event: DomainEvent = {
    id: generateId(),
    type: DOMAIN_EVENTS.COMMENT_ADDED,
    tenantId, userId,
    payload: { commentId, taskId, projectId: task.project_id, content: input.content },
    timestamp: new Date().toISOString(),
  };
  await publish("domain.events", event);

  logger.info({ tenantId, taskId, commentId }, "Comment created");
  return rows[0];
}

export async function listComments(tenantId: string, taskId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT c.id, c.content, c.user_id, c.edited_at, c.created_at,
            u.full_name, u.avatar_url
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.task_id = $1 AND c.deleted_at IS NULL
     ORDER BY c.created_at ASC`,
    [taskId]
  );
  return rows;
}

export async function updateComment(
  tenantId: string,
  userId: string,
  commentId: string,
  input: UpdateCommentInput
) {
  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE comments SET content = $1, edited_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
     RETURNING id, content, edited_at, updated_at`,
    [input.content, commentId, userId]
  );
  if (rows.length === 0) throw new NotFoundError("Comment", commentId);
  return rows[0];
}

export async function deleteComment(tenantId: string, userId: string, commentId: string) {
  const { rowCount } = await queryWithTenant(
    tenantId,
    "UPDATE comments SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
    [commentId, userId]
  );
  if (rowCount === 0) throw new NotFoundError("Comment", commentId);
}

// ═══════════════════════════════════════════════════════════
// ATTACHMENTS
// ═══════════════════════════════════════════════════════════

export async function createAttachment(
  tenantId: string,
  userId: string,
  taskId: string,
  input: CreateAttachmentInput
) {
  await getTask(tenantId, taskId); // verify task exists

  const attachmentId = generateId();
  const { rows } = await queryWithTenant(
    tenantId,
    `INSERT INTO attachments (id, tenant_id, task_id, uploaded_by, filename, file_size, mime_type, storage_key, storage_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, task_id, filename, file_size, mime_type, storage_url, created_at`,
    [attachmentId, tenantId, taskId, userId, input.filename, input.fileSize, input.mimeType, input.storageKey, input.storageUrl ?? null]
  );
  return rows[0];
}

export async function listAttachments(tenantId: string, taskId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT a.id, a.filename, a.file_size, a.mime_type, a.storage_url, a.created_at,
            u.full_name AS uploaded_by_name
     FROM attachments a
     JOIN users u ON u.id = a.uploaded_by
     WHERE a.task_id = $1 AND a.deleted_at IS NULL
     ORDER BY a.created_at DESC`,
    [taskId]
  );
  return rows;
}

export async function deleteAttachment(tenantId: string, attachmentId: string) {
  const { rowCount } = await queryWithTenant(
    tenantId,
    "UPDATE attachments SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    [attachmentId]
  );
  if (rowCount === 0) throw new NotFoundError("Attachment", attachmentId);
}

// ═══════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════

export async function getActivityLog(
  tenantId: string,
  taskId: string,
  page: number = 1,
  limit: number = 50
) {
  const offset = (page - 1) * limit;
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT al.id, al.action, al.entity_type, al.entity_id, al.changes, al.created_at,
            u.full_name, u.avatar_url
     FROM activity_logs al
     JOIN users u ON u.id = al.user_id
     WHERE al.task_id = $1
     ORDER BY al.created_at DESC
     LIMIT $2 OFFSET $3`,
    [taskId, limit, offset]
  );
  return rows;
}

// ─── Internal helper ────────────────────────────────────────
async function logActivity(
  tenantId: string,
  projectId: string,
  taskId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes: Record<string, unknown>
) {
  try {
    await queryWithTenant(
      tenantId,
      `INSERT INTO activity_logs (id, tenant_id, project_id, task_id, user_id, action, entity_type, entity_id, changes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [generateId(), tenantId, projectId, taskId, userId, action, entityType, entityId, JSON.stringify(changes)]
    );
  } catch (err) {
    logger.error({ err, tenantId, taskId, action }, "Failed to log activity");
  }
}
