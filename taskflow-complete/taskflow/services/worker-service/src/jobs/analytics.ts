import { query, queryWithTenant } from "@taskflow/db";
import { createLogger } from "@taskflow/utils";

const logger = createLogger("worker:analytics");

/**
 * Refresh analytics for all tenants.
 * Called on a cron schedule.
 */
export async function refreshAllAnalytics(): Promise<void> {
  const { rows: tenants } = await query(
    "SELECT id FROM tenants WHERE deleted_at IS NULL"
  );

  logger.info({ tenantCount: tenants.length }, "Starting analytics refresh for all tenants");

  for (const tenant of tenants) {
    try {
      await refreshTenantAnalytics(tenant.id);
    } catch (err) {
      logger.error({ err, tenantId: tenant.id }, "Failed to refresh analytics for tenant");
    }
  }

  logger.info("Analytics refresh complete for all tenants");
}

async function refreshTenantAnalytics(tenantId: string): Promise<void> {
  // Refresh project summaries
  const { rows: projects } = await queryWithTenant(
    tenantId,
    "SELECT id FROM projects WHERE deleted_at IS NULL"
  );

  for (const project of projects) {
    await queryWithTenant(
      tenantId,
      `INSERT INTO analytics_project_summary
         (id, tenant_id, project_id, total_tasks, completed_tasks, overdue_tasks, total_members, progress_pct, last_activity_at)
       SELECT
         COALESCE(aps.id, uuid_generate_v4()), $1, $2,
         COALESCE(ts.total, 0), COALESCE(ts.completed, 0), COALESCE(ts.overdue, 0),
         COALESCE(mc.count, 0),
         CASE WHEN COALESCE(ts.total, 0) = 0 THEN 0
           ELSE ROUND(COALESCE(ts.completed, 0)::numeric / ts.total::numeric * 100, 1) END,
         la.last_at
       FROM (SELECT 1) d
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'done')::int AS completed,
                COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done')::int AS overdue
         FROM tasks WHERE project_id = $2 AND deleted_at IS NULL
       ) ts ON true
       LEFT JOIN LATERAL (SELECT COUNT(*)::int AS count FROM project_members WHERE project_id = $2) mc ON true
       LEFT JOIN LATERAL (SELECT MAX(created_at) AS last_at FROM activity_logs WHERE project_id = $2) la ON true
       LEFT JOIN analytics_project_summary aps ON aps.project_id = $2 AND aps.tenant_id = $1
       ON CONFLICT (tenant_id, project_id)
       DO UPDATE SET total_tasks = EXCLUDED.total_tasks, completed_tasks = EXCLUDED.completed_tasks,
         overdue_tasks = EXCLUDED.overdue_tasks, total_members = EXCLUDED.total_members,
         progress_pct = EXCLUDED.progress_pct, last_activity_at = EXCLUDED.last_activity_at, updated_at = NOW()`,
      [tenantId, project.id]
    );

    // Daily metrics
    await queryWithTenant(
      tenantId,
      `INSERT INTO analytics_daily_tasks (id, tenant_id, project_id, date, tasks_created, tasks_completed, tasks_overdue, tasks_in_progress)
       SELECT uuid_generate_v4(), $1, $2, CURRENT_DATE,
         (SELECT COUNT(*)::int FROM tasks WHERE project_id = $2 AND deleted_at IS NULL AND created_at::date = CURRENT_DATE),
         (SELECT COUNT(*)::int FROM tasks WHERE project_id = $2 AND deleted_at IS NULL AND status = 'done' AND updated_at::date = CURRENT_DATE),
         (SELECT COUNT(*)::int FROM tasks WHERE project_id = $2 AND deleted_at IS NULL AND due_date < NOW() AND status != 'done'),
         (SELECT COUNT(*)::int FROM tasks WHERE project_id = $2 AND deleted_at IS NULL AND status = 'in_progress')
       ON CONFLICT (tenant_id, project_id, date)
       DO UPDATE SET tasks_created = EXCLUDED.tasks_created, tasks_completed = EXCLUDED.tasks_completed,
         tasks_overdue = EXCLUDED.tasks_overdue, tasks_in_progress = EXCLUDED.tasks_in_progress, updated_at = NOW()`,
      [tenantId, project.id]
    );
  }

  logger.debug({ tenantId, projectCount: projects.length }, "Tenant analytics refreshed");
}
