import {
  queryWithTenant,
  transactionWithTenant,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  publish,
} from "@taskflow/db";
import {
  generateId,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  createLogger,
  DOMAIN_EVENTS,
  type DomainEvent,
} from "@taskflow/utils";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  AddProjectMemberInput,
  UpdateProjectMemberInput,
  ListProjectsQuery,
} from "./schemas.js";

const logger = createLogger("project-service:service");

// ─── Create Project ─────────────────────────────────────────
export async function createProject(
  tenantId: string,
  userId: string,
  input: CreateProjectInput
) {
  return transactionWithTenant(tenantId, async (client) => {
    // Check slug uniqueness within tenant
    const { rows: existing } = await client.query(
      `SELECT id FROM projects
       WHERE tenant_id = $1 AND slug = $2 AND deleted_at IS NULL`,
      [tenantId, input.slug]
    );
    if (existing.length > 0) {
      throw new ConflictError(`Project slug '${input.slug}' already exists in this workspace`);
    }

    const projectId = generateId();

    // Create project
    const { rows } = await client.query(
      `INSERT INTO projects (id, tenant_id, name, slug, description, color, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tenant_id, name, slug, description, color, is_archived, owner_id, created_at, updated_at`,
      [
        projectId,
        tenantId,
        input.name,
        input.slug,
        input.description ?? null,
        input.color ?? "#6366f1",
        userId,
      ]
    );

    // Add creator as project admin
    await client.query(
      `INSERT INTO project_members (tenant_id, project_id, user_id, role)
       VALUES ($1, $2, $3, 'admin')`,
      [tenantId, projectId, userId]
    );

    // Create default board
    const boardId = generateId();
    await client.query(
      `INSERT INTO boards (id, tenant_id, project_id, name, position)
       VALUES ($1, $2, $3, 'Main Board', 'aaa')`,
      [boardId, tenantId, projectId]
    );

    // Create default columns
    const defaultColumns = [
      { name: "To Do", position: "aaa", color: "#ef4444" },
      { name: "In Progress", position: "bbb", color: "#f59e0b" },
      { name: "In Review", position: "ccc", color: "#3b82f6" },
      { name: "Done", position: "ddd", color: "#10b981" },
    ];

    for (const col of defaultColumns) {
      await client.query(
        `INSERT INTO columns (id, tenant_id, board_id, name, position, color)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [generateId(), tenantId, boardId, col.name, col.position, col.color]
      );
    }

    // Publish event
    const event: DomainEvent = {
      id: generateId(),
      type: DOMAIN_EVENTS.PROJECT_CREATED,
      tenantId,
      userId,
      payload: { projectId, name: input.name, slug: input.slug },
      timestamp: new Date().toISOString(),
    };
    await publish("domain.events", event);

    // Invalidate list cache
    await cacheDelPattern(`projects:${tenantId}:*`);

    logger.info({ tenantId, projectId }, "Project created");

    return {
      ...rows[0],
      board: { id: boardId, name: "Main Board" },
      columns: defaultColumns,
    };
  });
}

// ─── Get Project ────────────────────────────────────────────
export async function getProject(tenantId: string, projectId: string) {
  const cacheKey = `project:${tenantId}:${projectId}`;
  const cached = await cacheGet<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT p.id, p.name, p.slug, p.description, p.color, p.is_archived,
            p.owner_id, p.created_at, p.updated_at,
            u.full_name AS owner_name, u.email AS owner_email
     FROM projects p
     JOIN users u ON u.id = p.owner_id
     WHERE p.id = $1 AND p.deleted_at IS NULL`,
    [projectId]
  );

  if (rows.length === 0) {
    throw new NotFoundError("Project", projectId);
  }

  await cacheSet(cacheKey, rows[0], 300);
  return rows[0];
}

// ─── List Projects ──────────────────────────────────────────
export async function listProjects(
  tenantId: string,
  _userId: string,
  queryParams: ListProjectsQuery
) {
  const { page, limit, archived, search } = queryParams;
  const offset = (page - 1) * limit;

  let whereClause = "p.deleted_at IS NULL";
  const values: unknown[] = [];
  let idx = 1;

  if (archived) {
    whereClause += " AND p.is_archived = true";
  } else {
    whereClause += " AND p.is_archived = false";
  }

  if (search) {
    whereClause += ` AND (p.name ILIKE $${idx} OR p.slug ILIKE $${idx})`;
    values.push(`%${search}%`);
    idx++;
  }

  // Count total
  const { rows: countRows } = await queryWithTenant(
    tenantId,
    `SELECT COUNT(*)::int AS total FROM projects p WHERE ${whereClause}`,
    values
  );
  const total = countRows[0]?.total ?? 0;

  // Fetch projects with progress stats
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT p.id, p.name, p.slug, p.description, p.color, p.is_archived,
            p.owner_id, p.created_at, p.updated_at,
            u.full_name AS owner_name,
            COALESCE(stats.total_tasks, 0)::int AS total_tasks,
            COALESCE(stats.completed_tasks, 0)::int AS completed_tasks,
            COALESCE(pm.member_count, 0)::int AS member_count
     FROM projects p
     JOIN users u ON u.id = p.owner_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS total_tasks,
              COUNT(*) FILTER (WHERE status = 'done')::int AS completed_tasks
       FROM tasks t
       WHERE t.project_id = p.id AND t.deleted_at IS NULL
     ) stats ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS member_count
       FROM project_members pm2
       WHERE pm2.project_id = p.id
     ) pm ON true
     WHERE ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  return { projects: rows, total, page, limit };
}

// ─── Update Project ─────────────────────────────────────────
export async function updateProject(
  tenantId: string,
  userId: string,
  projectId: string,
  input: UpdateProjectInput
) {
  await requireProjectRole(tenantId, projectId, userId, ["admin"]);

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    setClauses.push(`description = $${idx++}`);
    values.push(input.description);
  }
  if (input.color !== undefined) {
    setClauses.push(`color = $${idx++}`);
    values.push(input.color);
  }

  if (setClauses.length === 0) {
    return getProject(tenantId, projectId);
  }

  values.push(projectId);
  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE projects SET ${setClauses.join(", ")}, updated_at = NOW()
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING id, name, slug, description, color, is_archived, owner_id, created_at, updated_at`,
    values
  );

  if (rows.length === 0) {
    throw new NotFoundError("Project", projectId);
  }

  // Publish event
  const event: DomainEvent = {
    id: generateId(),
    type: DOMAIN_EVENTS.PROJECT_UPDATED,
    tenantId,
    userId,
    payload: { projectId, changes: input },
    timestamp: new Date().toISOString(),
  };
  await publish("domain.events", event);

  await cacheDel(`project:${tenantId}:${projectId}`);
  await cacheDelPattern(`projects:${tenantId}:*`);

  logger.info({ tenantId, projectId }, "Project updated");
  return rows[0];
}

// ─── Archive / Unarchive Project ────────────────────────────
export async function archiveProject(
  tenantId: string,
  userId: string,
  projectId: string,
  archive: boolean
) {
  await requireProjectRole(tenantId, projectId, userId, ["admin"]);

  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE projects SET is_archived = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, name, slug, is_archived, updated_at`,
    [archive, projectId]
  );

  if (rows.length === 0) {
    throw new NotFoundError("Project", projectId);
  }

  await cacheDel(`project:${tenantId}:${projectId}`);
  await cacheDelPattern(`projects:${tenantId}:*`);

  logger.info({ tenantId, projectId, archive }, "Project archive toggled");
  return rows[0];
}

// ─── Delete Project (soft) ──────────────────────────────────
export async function deleteProject(
  tenantId: string,
  userId: string,
  projectId: string
) {
  await requireProjectRole(tenantId, projectId, userId, ["admin"]);

  const { rowCount } = await queryWithTenant(
    tenantId,
    "UPDATE projects SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    [projectId]
  );

  if (rowCount === 0) {
    throw new NotFoundError("Project", projectId);
  }

  await cacheDel(`project:${tenantId}:${projectId}`);
  await cacheDelPattern(`projects:${tenantId}:*`);

  logger.info({ tenantId, projectId }, "Project deleted");
}

// ─── Add Project Member ─────────────────────────────────────
export async function addProjectMember(
  tenantId: string,
  userId: string,
  projectId: string,
  input: AddProjectMemberInput
) {
  await requireProjectRole(tenantId, projectId, userId, ["admin"]);

  // Verify target user is a workspace member
  const { rows: membership } = await queryWithTenant(
    tenantId,
    `SELECT id FROM memberships
     WHERE user_id = $1 AND accepted_at IS NOT NULL AND deleted_at IS NULL`,
    [input.userId]
  );
  if (membership.length === 0) {
    throw new ForbiddenError("User is not a member of this workspace");
  }

  // Check if already a project member
  const { rows: existing } = await queryWithTenant(
    tenantId,
    "SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, input.userId]
  );
  if (existing.length > 0) {
    throw new ConflictError("User is already a member of this project");
  }

  const { rows } = await queryWithTenant(
    tenantId,
    `INSERT INTO project_members (id, tenant_id, project_id, user_id, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, project_id, user_id, role, created_at`,
    [generateId(), tenantId, projectId, input.userId, input.role]
  );

  // Publish event
  const event: DomainEvent = {
    id: generateId(),
    type: DOMAIN_EVENTS.MEMBER_ADDED,
    tenantId,
    userId,
    payload: { projectId, addedUserId: input.userId, role: input.role },
    timestamp: new Date().toISOString(),
  };
  await publish("domain.events", event);

  logger.info({ tenantId, projectId, addedUserId: input.userId }, "Project member added");
  return rows[0];
}

// ─── Update Project Member Role ─────────────────────────────
export async function updateProjectMemberRole(
  tenantId: string,
  userId: string,
  projectId: string,
  memberId: string,
  input: UpdateProjectMemberInput
) {
  await requireProjectRole(tenantId, projectId, userId, ["admin"]);

  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE project_members SET role = $1
     WHERE id = $2 AND project_id = $3
     RETURNING id, project_id, user_id, role`,
    [input.role, memberId, projectId]
  );

  if (rows.length === 0) {
    throw new NotFoundError("Project member", memberId);
  }

  logger.info({ tenantId, projectId, memberId, newRole: input.role }, "Project member role updated");
  return rows[0];
}

// ─── Remove Project Member ──────────────────────────────────
export async function removeProjectMember(
  tenantId: string,
  userId: string,
  projectId: string,
  memberId: string
) {
  await requireProjectRole(tenantId, projectId, userId, ["admin"]);

  const { rowCount } = await queryWithTenant(
    tenantId,
    "DELETE FROM project_members WHERE id = $1 AND project_id = $2",
    [memberId, projectId]
  );

  if (rowCount === 0) {
    throw new NotFoundError("Project member", memberId);
  }

  logger.info({ tenantId, projectId, memberId }, "Project member removed");
}

// ─── List Project Members ───────────────────────────────────
export async function listProjectMembers(tenantId: string, projectId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT pm.id, pm.user_id, pm.role, pm.created_at,
            u.email, u.full_name, u.avatar_url
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.created_at ASC`,
    [projectId]
  );
  return rows;
}

// ─── Get Project Progress ───────────────────────────────────
export async function getProjectProgress(tenantId: string, projectId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT
       COUNT(*)::int AS total_tasks,
       COUNT(*) FILTER (WHERE status = 'done')::int AS completed_tasks,
       COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_tasks,
       COUNT(*) FILTER (WHERE status = 'in_review')::int AS in_review_tasks,
       COUNT(*) FILTER (WHERE status = 'todo')::int AS todo_tasks,
       COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done')::int AS overdue_tasks,
       CASE
         WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(COUNT(*) FILTER (WHERE status = 'done')::numeric / COUNT(*)::numeric * 100, 2)
       END AS progress_pct
     FROM tasks
     WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );

  return rows[0] ?? {
    total_tasks: 0,
    completed_tasks: 0,
    in_progress_tasks: 0,
    in_review_tasks: 0,
    todo_tasks: 0,
    overdue_tasks: 0,
    progress_pct: 0,
  };
}

// ─── Get Project Boards (with columns) ──────────────────────
export async function getProjectBoards(tenantId: string, projectId: string) {
  const { rows: boards } = await queryWithTenant(
    tenantId,
    `SELECT id, name, position, created_at
     FROM boards
     WHERE project_id = $1 AND deleted_at IS NULL
     ORDER BY position ASC`,
    [projectId]
  );

  // Fetch columns for all boards
  const boardIds = boards.map((b: Record<string, unknown>) => b.id);
  if (boardIds.length === 0) return [];

  const placeholders = boardIds.map((_: unknown, i: number) => `$${i + 1}`).join(", ");
  const { rows: columns } = await queryWithTenant(
    tenantId,
    `SELECT id, board_id, name, position, color, wip_limit, created_at
     FROM columns
     WHERE board_id IN (${placeholders}) AND deleted_at IS NULL
     ORDER BY position ASC`,
    boardIds
  );

  // Group columns by board
  return boards.map((board: Record<string, unknown>) => ({
    ...board,
    columns: columns.filter((c: Record<string, unknown>) => c.board_id === board.id),
  }));
}

// ─── Helpers ────────────────────────────────────────────────

async function requireProjectRole(
  tenantId: string,
  projectId: string,
  userId: string,
  allowedRoles: string[]
): Promise<void> {
  // Project owner (from projects table) always has admin access
  const { rows: project } = await queryWithTenant(
    tenantId,
    "SELECT owner_id FROM projects WHERE id = $1 AND deleted_at IS NULL",
    [projectId]
  );
  if (project.length === 0) {
    throw new NotFoundError("Project", projectId);
  }
  if (project[0]!.owner_id === userId) return;

  // Check project_members role
  const { rows: members } = await queryWithTenant(
    tenantId,
    "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, userId]
  );
  if (members.length === 0) {
    throw new ForbiddenError("Not a member of this project");
  }
  if (!allowedRoles.includes(members[0]!.role)) {
    throw new ForbiddenError(
      `This action requires one of: ${allowedRoles.join(", ")}`
    );
  }
}
