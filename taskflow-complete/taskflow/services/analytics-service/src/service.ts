import { queryWithTenant } from "@taskflow/db";
import { createLogger } from "@taskflow/utils";
import type {
  ProjectAnalyticsQuery,
  UserProductivityQuery,
  DashboardQuery,
} from "./schemas.js";

const logger = createLogger("analytics-service:service");

// ═══════════════════════════════════════════════════════════
// DASHBOARD (tenant-wide overview)
// ═══════════════════════════════════════════════════════════

export async function getDashboard(tenantId: string, _query: DashboardQuery) {
  const [overview, recentActivity, tasksByStatus, tasksByPriority, projectSummaries] =
    await Promise.all([
      getTenantOverview(tenantId),
      getRecentActivity(tenantId, 20),
      getTasksByStatus(tenantId),
      getTasksByPriority(tenantId),
      getProjectSummaries(tenantId),
    ]);

  return {
    overview,
    recentActivity,
    tasksByStatus,
    tasksByPriority,
    projectSummaries,
  };
}

async function getTenantOverview(tenantId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT
       (SELECT COUNT(*)::int FROM projects WHERE deleted_at IS NULL AND is_archived = false) AS total_projects,
       (SELECT COUNT(*)::int FROM tasks WHERE deleted_at IS NULL) AS total_tasks,
       (SELECT COUNT(*)::int FROM tasks WHERE deleted_at IS NULL AND status = 'done') AS completed_tasks,
       (SELECT COUNT(*)::int FROM tasks WHERE deleted_at IS NULL AND due_date < NOW() AND status != 'done') AS overdue_tasks,
       (SELECT COUNT(*)::int FROM tasks WHERE deleted_at IS NULL AND status = 'in_progress') AS in_progress_tasks,
       (SELECT COUNT(*)::int FROM memberships WHERE deleted_at IS NULL AND accepted_at IS NOT NULL) AS total_members,
       (SELECT COUNT(*)::int FROM tasks WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '7 days') AS tasks_created_7d,
       (SELECT COUNT(*)::int FROM tasks WHERE deleted_at IS NULL AND status = 'done' AND updated_at >= NOW() - INTERVAL '7 days') AS tasks_completed_7d`
  );
  return rows[0];
}

async function getTasksByStatus(tenantId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT status, COUNT(*)::int AS count
     FROM tasks WHERE deleted_at IS NULL
     GROUP BY status
     ORDER BY CASE status
       WHEN 'todo' THEN 1
       WHEN 'in_progress' THEN 2
       WHEN 'in_review' THEN 3
       WHEN 'done' THEN 4
       WHEN 'archived' THEN 5
     END`
  );
  return rows;
}

async function getTasksByPriority(tenantId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT priority, COUNT(*)::int AS count
     FROM tasks WHERE deleted_at IS NULL AND status != 'done'
     GROUP BY priority
     ORDER BY CASE priority
       WHEN 'urgent' THEN 1
       WHEN 'high' THEN 2
       WHEN 'medium' THEN 3
       WHEN 'low' THEN 4
       WHEN 'none' THEN 5
     END`
  );
  return rows;
}

async function getProjectSummaries(tenantId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT
       p.id, p.name, p.slug, p.color,
       COUNT(t.id)::int AS total_tasks,
       COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS completed_tasks,
       COUNT(t.id) FILTER (WHERE t.due_date < NOW() AND t.status != 'done')::int AS overdue_tasks,
       CASE
         WHEN COUNT(t.id) = 0 THEN 0
         ELSE ROUND(COUNT(t.id) FILTER (WHERE t.status = 'done')::numeric / COUNT(t.id)::numeric * 100, 1)
       END AS progress_pct,
       (SELECT COUNT(*)::int FROM project_members pm WHERE pm.project_id = p.id) AS member_count
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
     WHERE p.deleted_at IS NULL AND p.is_archived = false
     GROUP BY p.id, p.name, p.slug, p.color
     ORDER BY p.created_at DESC
     LIMIT 20`
  );
  return rows;
}

async function getRecentActivity(tenantId: string, limit: number) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT al.id, al.action, al.entity_type, al.entity_id, al.changes, al.created_at,
            u.full_name, u.avatar_url,
            p.name AS project_name
     FROM activity_logs al
     JOIN users u ON u.id = al.user_id
     LEFT JOIN projects p ON p.id = al.project_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

// ═══════════════════════════════════════════════════════════
// PROJECT ANALYTICS
// ═══════════════════════════════════════════════════════════

export async function getProjectAnalytics(
  tenantId: string,
  params: ProjectAnalyticsQuery
) {
  const [summary, dailyTrend, memberStats, columnDistribution, burndown] =
    await Promise.all([
      getProjectSummary(tenantId, params.projectId),
      getProjectDailyTrend(tenantId, params),
      getProjectMemberStats(tenantId, params.projectId),
      getColumnDistribution(tenantId, params.projectId),
      getProjectBurndown(tenantId, params),
    ]);

  return { summary, dailyTrend, memberStats, columnDistribution, burndown };
}

async function getProjectSummary(tenantId: string, projectId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT
       COUNT(*)::int AS total_tasks,
       COUNT(*) FILTER (WHERE status = 'done')::int AS completed_tasks,
       COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_tasks,
       COUNT(*) FILTER (WHERE status = 'in_review')::int AS in_review_tasks,
       COUNT(*) FILTER (WHERE status = 'todo')::int AS todo_tasks,
       COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done')::int AS overdue_tasks,
       COALESCE(AVG(EXTRACT(EPOCH FROM (
         CASE WHEN status = 'done' THEN updated_at ELSE NULL END
       ) - created_at) / 3600), 0)::numeric(10,2) AS avg_completion_hours,
       CASE
         WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(COUNT(*) FILTER (WHERE status = 'done')::numeric / COUNT(*)::numeric * 100, 1)
       END AS progress_pct
     FROM tasks
     WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  return rows[0];
}

async function getProjectDailyTrend(tenantId: string, params: ProjectAnalyticsQuery) {
  const from = params.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const to = params.to ?? new Date().toISOString().split("T")[0];

  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT
       d.date::date AS date,
       COALESCE(created.count, 0)::int AS tasks_created,
       COALESCE(completed.count, 0)::int AS tasks_completed
     FROM generate_series($2::date, $3::date, '1 day'::interval) AS d(date)
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS count FROM tasks
       WHERE project_id = $1 AND deleted_at IS NULL
       AND created_at::date = d.date
     ) created ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS count FROM tasks
       WHERE project_id = $1 AND deleted_at IS NULL AND status = 'done'
       AND updated_at::date = d.date
     ) completed ON true
     ORDER BY d.date`,
    [params.projectId, from, to]
  );
  return rows;
}

async function getProjectMemberStats(tenantId: string, projectId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT
       u.id AS user_id, u.full_name, u.avatar_url,
       COUNT(t.id)::int AS assigned_tasks,
       COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS completed_tasks,
       COUNT(t.id) FILTER (WHERE t.due_date < NOW() AND t.status != 'done')::int AS overdue_tasks,
       COUNT(c.id)::int AS comments_count
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = $1 AND t.deleted_at IS NULL
     LEFT JOIN comments c ON c.user_id = u.id AND c.task_id = t.id AND c.deleted_at IS NULL
     WHERE pm.project_id = $1
     GROUP BY u.id, u.full_name, u.avatar_url
     ORDER BY completed_tasks DESC`,
    [projectId]
  );
  return rows;
}

async function getColumnDistribution(tenantId: string, projectId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT
       col.id AS column_id, col.name AS column_name, col.color,
       COUNT(t.id)::int AS task_count
     FROM columns col
     JOIN boards b ON b.id = col.board_id AND b.project_id = $1
     LEFT JOIN tasks t ON t.column_id = col.id AND t.deleted_at IS NULL
     WHERE col.deleted_at IS NULL AND b.deleted_at IS NULL
     GROUP BY col.id, col.name, col.color, col.position
     ORDER BY col.position ASC`,
    [projectId]
  );
  return rows;
}

async function getProjectBurndown(tenantId: string, params: ProjectAnalyticsQuery) {
  const from = params.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const to = params.to ?? new Date().toISOString().split("T")[0];

  const { rows } = await queryWithTenant(
    tenantId,
    `WITH daily AS (
       SELECT d.date::date AS date,
         (SELECT COUNT(*) FROM tasks
          WHERE project_id = $1 AND deleted_at IS NULL
          AND created_at::date <= d.date AND status != 'done')::int AS remaining,
         (SELECT COUNT(*) FROM tasks
          WHERE project_id = $1 AND deleted_at IS NULL
          AND created_at::date <= d.date)::int AS total
       FROM generate_series($2::date, $3::date, '1 day'::interval) AS d(date)
     )
     SELECT date, remaining, total,
       CASE WHEN total = 0 THEN 0
         ELSE ROUND((total - remaining)::numeric / total::numeric * 100, 1)
       END AS completion_pct
     FROM daily
     ORDER BY date`,
    [params.projectId, from, to]
  );
  return rows;
}

// ═══════════════════════════════════════════════════════════
// USER PRODUCTIVITY
// ═══════════════════════════════════════════════════════════

export async function getUserProductivity(
  tenantId: string,
  params: UserProductivityQuery
) {
  const from = params.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const to = params.to ?? new Date().toISOString().split("T")[0];

  if (params.userId) {
    return getSingleUserProductivity(tenantId, params.userId, from!, to!);
  }

  return getTeamProductivity(tenantId, from!, to!);
}

async function getSingleUserProductivity(
  tenantId: string,
  userId: string,
  from: string,
  to: string
) {
  const { rows: summary } = await queryWithTenant(
    tenantId,
    `SELECT
       COUNT(t.id)::int AS total_assigned,
       COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS completed,
       COUNT(t.id) FILTER (WHERE t.due_date < NOW() AND t.status != 'done')::int AS overdue,
       COUNT(DISTINCT c.id)::int AS comments_made,
       COALESCE(SUM(t.actual_hours), 0)::numeric(10,2) AS hours_logged
     FROM tasks t
     LEFT JOIN comments c ON c.user_id = $1 AND c.task_id = t.id AND c.deleted_at IS NULL
     WHERE t.assignee_id = $1 AND t.deleted_at IS NULL
     AND t.created_at::date BETWEEN $2 AND $3`,
    [userId, from, to]
  );

  const { rows: dailyTrend } = await queryWithTenant(
    tenantId,
    `SELECT
       d.date::date AS date,
       COALESCE(completed.count, 0)::int AS tasks_completed,
       COALESCE(comments.count, 0)::int AS comments_made
     FROM generate_series($2::date, $3::date, '1 day'::interval) AS d(date)
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS count FROM tasks
       WHERE assignee_id = $1 AND deleted_at IS NULL AND status = 'done'
       AND updated_at::date = d.date
     ) completed ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS count FROM comments
       WHERE user_id = $1 AND deleted_at IS NULL
       AND created_at::date = d.date
     ) comments ON true
     ORDER BY d.date`,
    [userId, from, to]
  );

  return { summary: summary[0], dailyTrend };
}

async function getTeamProductivity(tenantId: string, from: string, to: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT
       u.id AS user_id, u.full_name, u.avatar_url,
       COUNT(t.id)::int AS total_assigned,
       COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS completed,
       COUNT(t.id) FILTER (WHERE t.due_date < NOW() AND t.status != 'done')::int AS overdue,
       COALESCE(SUM(t.actual_hours), 0)::numeric(10,2) AS hours_logged,
       (SELECT COUNT(*)::int FROM comments c
        WHERE c.user_id = u.id AND c.deleted_at IS NULL
        AND c.created_at::date BETWEEN $1 AND $2) AS comments_made
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN tasks t ON t.assignee_id = u.id AND t.deleted_at IS NULL
       AND t.created_at::date BETWEEN $1 AND $2
     WHERE m.accepted_at IS NOT NULL AND m.deleted_at IS NULL
     GROUP BY u.id, u.full_name, u.avatar_url
     ORDER BY completed DESC`,
    [from, to]
  );
  return { members: rows };
}

// ═══════════════════════════════════════════════════════════
// CQRS READ MODEL REFRESH
// ═══════════════════════════════════════════════════════════

/**
 * Refresh the analytics_project_summary table.
 * Called by the worker service periodically.
 */
export async function refreshProjectSummaries(tenantId: string) {
  const { rows: projects } = await queryWithTenant(
    tenantId,
    "SELECT id FROM projects WHERE deleted_at IS NULL"
  );

  for (const project of projects) {
    await queryWithTenant(
      tenantId,
      `INSERT INTO analytics_project_summary (id, tenant_id, project_id, total_tasks, completed_tasks, overdue_tasks, total_members, progress_pct, last_activity_at)
       SELECT
         COALESCE(aps.id, uuid_generate_v4()),
         $1,
         $2,
         COALESCE(ts.total, 0),
         COALESCE(ts.completed, 0),
         COALESCE(ts.overdue, 0),
         COALESCE(mc.count, 0),
         CASE WHEN COALESCE(ts.total, 0) = 0 THEN 0
           ELSE ROUND(COALESCE(ts.completed, 0)::numeric / ts.total::numeric * 100, 1)
         END,
         la.last_at
       FROM (SELECT 1) dummy
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'done')::int AS completed,
                COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done')::int AS overdue
         FROM tasks WHERE project_id = $2 AND deleted_at IS NULL
       ) ts ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS count FROM project_members WHERE project_id = $2
       ) mc ON true
       LEFT JOIN LATERAL (
         SELECT MAX(created_at) AS last_at FROM activity_logs WHERE project_id = $2
       ) la ON true
       LEFT JOIN analytics_project_summary aps ON aps.project_id = $2 AND aps.tenant_id = $1
       ON CONFLICT (tenant_id, project_id)
       DO UPDATE SET
         total_tasks = EXCLUDED.total_tasks,
         completed_tasks = EXCLUDED.completed_tasks,
         overdue_tasks = EXCLUDED.overdue_tasks,
         total_members = EXCLUDED.total_members,
         progress_pct = EXCLUDED.progress_pct,
         last_activity_at = EXCLUDED.last_activity_at,
         updated_at = NOW()`,
      [tenantId, project.id]
    );
  }

  logger.info({ tenantId, projectCount: projects.length }, "Project summaries refreshed");
}

/**
 * Refresh daily task metrics for today.
 */
export async function refreshDailyMetrics(tenantId: string) {
  const { rows: projects } = await queryWithTenant(
    tenantId,
    "SELECT id FROM projects WHERE deleted_at IS NULL"
  );

  for (const project of projects) {
    await queryWithTenant(
      tenantId,
      `INSERT INTO analytics_daily_tasks (id, tenant_id, project_id, date, tasks_created, tasks_completed, tasks_overdue, tasks_in_progress)
       SELECT
         uuid_generate_v4(), $1, $2, CURRENT_DATE,
         COALESCE(created.c, 0),
         COALESCE(completed.c, 0),
         COALESCE(overdue.c, 0),
         COALESCE(in_prog.c, 0)
       FROM (SELECT 1) dummy
       LEFT JOIN LATERAL (SELECT COUNT(*)::int AS c FROM tasks WHERE project_id = $2 AND deleted_at IS NULL AND created_at::date = CURRENT_DATE) created ON true
       LEFT JOIN LATERAL (SELECT COUNT(*)::int AS c FROM tasks WHERE project_id = $2 AND deleted_at IS NULL AND status = 'done' AND updated_at::date = CURRENT_DATE) completed ON true
       LEFT JOIN LATERAL (SELECT COUNT(*)::int AS c FROM tasks WHERE project_id = $2 AND deleted_at IS NULL AND due_date < NOW() AND status != 'done') overdue ON true
       LEFT JOIN LATERAL (SELECT COUNT(*)::int AS c FROM tasks WHERE project_id = $2 AND deleted_at IS NULL AND status = 'in_progress') in_prog ON true
       ON CONFLICT (tenant_id, project_id, date)
       DO UPDATE SET
         tasks_created = EXCLUDED.tasks_created,
         tasks_completed = EXCLUDED.tasks_completed,
         tasks_overdue = EXCLUDED.tasks_overdue,
         tasks_in_progress = EXCLUDED.tasks_in_progress,
         updated_at = NOW()`,
      [tenantId, project.id]
    );
  }

  logger.info({ tenantId, projectCount: projects.length }, "Daily metrics refreshed");
}
