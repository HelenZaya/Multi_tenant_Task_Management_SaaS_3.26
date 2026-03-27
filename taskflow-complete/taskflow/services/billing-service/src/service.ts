import {
  queryWithTenant,
  query,
  transactionWithTenant,
  cacheGet,
  cacheSet,
  cacheDel,
} from "@taskflow/db";
import {
  generateId,
  NotFoundError,
  PlanLimitError,
  createLogger,
} from "@taskflow/utils";
import {
  getPlanDefinition,
  isLimitExceeded,
  PLAN_DEFINITIONS,
  type PlanDefinition,
} from "./plans.js";
import type {
  ChangePlanInput,
  UpdateSubscriptionInput,
  SetFeatureFlagInput,
  RecordUsageInput,
  GetUsageQuery,
} from "./schemas.js";

const logger = createLogger("billing-service:service");

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════

export async function getSubscription(tenantId: string) {
  const cacheKey = `subscription:${tenantId}`;
  const cached = await cacheGet<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT id, plan, status, current_period_start, current_period_end,
            cancel_at, canceled_at, trial_start, trial_end,
            external_id, external_provider, metadata, created_at, updated_at
     FROM subscriptions
     WHERE status IN ('active', 'trialing')
     LIMIT 1`
  );

  if (rows.length === 0) {
    // No active subscription — return free plan info
    const freePlan = {
      plan: "free",
      status: "active",
      current_period_start: null,
      current_period_end: null,
    };
    return freePlan;
  }

  await cacheSet(cacheKey, rows[0], 300);
  return rows[0];
}

export async function changePlan(
  tenantId: string,
  _userId: string,
  input: ChangePlanInput
) {
  return transactionWithTenant(tenantId, async (client) => {
    // Get current subscription
    const { rows: current } = await client.query(
      `SELECT id, plan, status FROM subscriptions
       WHERE tenant_id = $1 AND status IN ('active', 'trialing')
       LIMIT 1`,
      [tenantId]
    );

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

    if (current.length > 0) {
      // Update existing subscription
      const { rows } = await client.query(
        `UPDATE subscriptions
         SET plan = $1, status = 'active',
             current_period_start = $2, current_period_end = $3,
             canceled_at = NULL, cancel_at = NULL,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [input.plan, now, periodEnd, current[0]!.id]
      );

      // Update tenant plan
      await client.query(
        "UPDATE tenants SET plan = $1, updated_at = NOW() WHERE id = $2",
        [input.plan, tenantId]
      );

      await cacheDel(`subscription:${tenantId}`);
      await cacheDel(`tenant:${tenantId}`);

      logger.info(
        { tenantId, from: current[0]!.plan, to: input.plan },
        "Plan changed"
      );
      return rows[0];
    } else {
      // Create new subscription
      const subId = generateId();
      const { rows } = await client.query(
        `INSERT INTO subscriptions (id, tenant_id, plan, status, current_period_start, current_period_end)
         VALUES ($1, $2, $3, 'active', $4, $5)
         RETURNING *`,
        [subId, tenantId, input.plan, now, periodEnd]
      );

      await client.query(
        "UPDATE tenants SET plan = $1, updated_at = NOW() WHERE id = $2",
        [input.plan, tenantId]
      );

      await cacheDel(`subscription:${tenantId}`);
      await cacheDel(`tenant:${tenantId}`);

      logger.info({ tenantId, plan: input.plan }, "Subscription created");
      return rows[0];
    }
  });
}

export async function cancelSubscription(tenantId: string, _userId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE subscriptions
     SET status = 'canceled', canceled_at = NOW(), cancel_at = current_period_end, updated_at = NOW()
     WHERE status IN ('active', 'trialing')
     RETURNING id, plan, status, canceled_at, cancel_at`
  );

  if (rows.length === 0) {
    throw new NotFoundError("Active subscription");
  }

  await cacheDel(`subscription:${tenantId}`);
  logger.info({ tenantId }, "Subscription canceled");
  return rows[0];
}

export async function updateSubscription(
  tenantId: string,
  input: UpdateSubscriptionInput
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.status !== undefined) { setClauses.push(`status = $${idx++}`); values.push(input.status); }
  if (input.externalId !== undefined) { setClauses.push(`external_id = $${idx++}`); values.push(input.externalId); }
  if (input.externalProvider !== undefined) { setClauses.push(`external_provider = $${idx++}`); values.push(input.externalProvider); }
  if (input.cancelAt !== undefined) { setClauses.push(`cancel_at = $${idx++}`); values.push(input.cancelAt ? new Date(input.cancelAt) : null); }
  if (input.trialEnd !== undefined) { setClauses.push(`trial_end = $${idx++}`); values.push(input.trialEnd ? new Date(input.trialEnd) : null); }
  if (input.metadata !== undefined) { setClauses.push(`metadata = metadata || $${idx++}::jsonb`); values.push(JSON.stringify(input.metadata)); }

  if (setClauses.length === 0) return getSubscription(tenantId);

  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE subscriptions SET ${setClauses.join(", ")}, updated_at = NOW()
     WHERE status IN ('active', 'trialing')
     RETURNING *`,
    values
  );

  if (rows.length === 0) throw new NotFoundError("Active subscription");

  await cacheDel(`subscription:${tenantId}`);
  return rows[0];
}

// ═══════════════════════════════════════════════════════════
// PLAN ENFORCEMENT
// ═══════════════════════════════════════════════════════════

export async function getTenantPlan(tenantId: string): Promise<PlanDefinition> {
  const { rows } = await query(
    "SELECT plan FROM tenants WHERE id = $1 AND deleted_at IS NULL",
    [tenantId]
  );
  const planName = rows[0]?.plan ?? "free";
  return getPlanDefinition(planName);
}

export async function checkMemberLimit(tenantId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const plan = await getTenantPlan(tenantId);
  const { rows } = await queryWithTenant(
    tenantId,
    "SELECT COUNT(*)::int AS count FROM memberships WHERE accepted_at IS NOT NULL AND deleted_at IS NULL"
  );
  const current = rows[0]?.count ?? 0;
  return {
    allowed: !isLimitExceeded(current, plan.maxMembers),
    current,
    limit: plan.maxMembers,
  };
}

export async function checkProjectLimit(tenantId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const plan = await getTenantPlan(tenantId);
  const { rows } = await queryWithTenant(
    tenantId,
    "SELECT COUNT(*)::int AS count FROM projects WHERE deleted_at IS NULL AND is_archived = false"
  );
  const current = rows[0]?.count ?? 0;
  return {
    allowed: !isLimitExceeded(current, plan.maxProjects),
    current,
    limit: plan.maxProjects,
  };
}

export async function checkTaskLimit(tenantId: string, projectId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const plan = await getTenantPlan(tenantId);
  const { rows } = await queryWithTenant(
    tenantId,
    "SELECT COUNT(*)::int AS count FROM tasks WHERE project_id = $1 AND deleted_at IS NULL",
    [projectId]
  );
  const current = rows[0]?.count ?? 0;
  return {
    allowed: !isLimitExceeded(current, plan.maxTasksPerProject),
    current,
    limit: plan.maxTasksPerProject,
  };
}

export async function enforcePlanLimit(
  tenantId: string,
  limitType: "members" | "projects" | "tasks",
  projectId?: string
): Promise<void> {
  let check: { allowed: boolean; current: number; limit: number };

  switch (limitType) {
    case "members":
      check = await checkMemberLimit(tenantId);
      break;
    case "projects":
      check = await checkProjectLimit(tenantId);
      break;
    case "tasks":
      check = await checkTaskLimit(tenantId, projectId!);
      break;
  }

  if (!check.allowed) {
    throw new PlanLimitError(
      `${limitType} (${check.current}/${check.limit})`
    );
  }
}

// ═══════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════

export async function getFeatureFlags(tenantId: string) {
  const cacheKey = `features:${tenantId}`;
  const cached = await cacheGet<Record<string, unknown>[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await queryWithTenant(
    tenantId,
    "SELECT feature, enabled, config, updated_at FROM feature_flags ORDER BY feature"
  );

  await cacheSet(cacheKey, rows, 300);
  return rows;
}

export async function checkFeature(tenantId: string, feature: string): Promise<boolean> {
  // Check custom override first
  const { rows } = await queryWithTenant(
    tenantId,
    "SELECT enabled FROM feature_flags WHERE feature = $1",
    [feature]
  );
  if (rows.length > 0) return rows[0]!.enabled;

  // Fall back to plan-based features
  const plan = await getTenantPlan(tenantId);
  return plan.features.includes(feature);
}

export async function setFeatureFlag(tenantId: string, input: SetFeatureFlagInput) {
  const { rows } = await queryWithTenant(
    tenantId,
    `INSERT INTO feature_flags (id, tenant_id, feature, enabled, config)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, feature)
     DO UPDATE SET enabled = $4, config = $5, updated_at = NOW()
     RETURNING feature, enabled, config, updated_at`,
    [generateId(), tenantId, input.feature, input.enabled, JSON.stringify(input.config ?? {})]
  );

  await cacheDel(`features:${tenantId}`);
  return rows[0];
}

export async function deleteFeatureFlag(tenantId: string, feature: string) {
  const { rowCount } = await queryWithTenant(
    tenantId,
    "DELETE FROM feature_flags WHERE feature = $1",
    [feature]
  );
  if (rowCount === 0) throw new NotFoundError("Feature flag", feature);
  await cacheDel(`features:${tenantId}`);
}

// ═══════════════════════════════════════════════════════════
// USAGE TRACKING
// ═══════════════════════════════════════════════════════════

export async function recordUsage(tenantId: string, input: RecordUsageInput) {
  const { rows } = await queryWithTenant(
    tenantId,
    `INSERT INTO usage_records (id, tenant_id, metric, value, period)
     VALUES ($1, $2, $3, $4, CURRENT_DATE)
     ON CONFLICT (tenant_id, metric, period)
     DO UPDATE SET value = usage_records.value + $4, updated_at = NOW()
     RETURNING metric, value, period`,
    [generateId(), tenantId, input.metric, input.value]
  );
  return rows[0];
}

export async function getUsage(tenantId: string, queryParams: GetUsageQuery) {
  let whereClause = "1=1";
  const values: unknown[] = [];
  let idx = 1;

  if (queryParams.metric) {
    whereClause += ` AND metric = $${idx++}`;
    values.push(queryParams.metric);
  }
  if (queryParams.from) {
    whereClause += ` AND period >= $${idx++}`;
    values.push(queryParams.from);
  }
  if (queryParams.to) {
    whereClause += ` AND period <= $${idx++}`;
    values.push(queryParams.to);
  }

  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT metric, value, period, updated_at
     FROM usage_records
     WHERE ${whereClause}
     ORDER BY period DESC, metric ASC`,
    values
  );
  return rows;
}

export async function getUsageSummary(tenantId: string) {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT metric, SUM(value)::bigint AS total_value,
            MIN(period) AS first_period, MAX(period) AS last_period
     FROM usage_records
     GROUP BY metric
     ORDER BY metric`
  );
  return rows;
}

// ═══════════════════════════════════════════════════════════
// PLAN INFO
// ═══════════════════════════════════════════════════════════

export function getAllPlans() {
  return Object.values(PLAN_DEFINITIONS);
}

export async function getTenantBillingOverview(tenantId: string) {
  const subscription = await getSubscription(tenantId);
  const plan = await getTenantPlan(tenantId);
  const memberCheck = await checkMemberLimit(tenantId);
  const projectCheck = await checkProjectLimit(tenantId);
  const features = await getFeatureFlags(tenantId);
  const usage = await getUsageSummary(tenantId);

  return {
    subscription,
    plan: {
      ...plan,
      limits: {
        members: { current: memberCheck.current, max: plan.maxMembers },
        projects: { current: projectCheck.current, max: plan.maxProjects },
      },
    },
    features,
    usage,
  };
}
