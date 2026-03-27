/**
 * Plan definitions — single source of truth for plan capabilities.
 */

export interface PlanDefinition {
  name: string;
  displayName: string;
  maxMembers: number;       // -1 = unlimited
  maxProjects: number;
  maxTasksPerProject: number;
  maxStorageMb: number;
  features: string[];
  priceMonthly: number;     // cents
  priceYearly: number;      // cents
}

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  free: {
    name: "free",
    displayName: "Free",
    maxMembers: 5,
    maxProjects: 3,
    maxTasksPerProject: 100,
    maxStorageMb: 100,
    features: [
      "basic_boards",
      "basic_tasks",
      "comments",
      "activity_log",
    ],
    priceMonthly: 0,
    priceYearly: 0,
  },

  pro: {
    name: "pro",
    displayName: "Pro",
    maxMembers: 50,
    maxProjects: 50,
    maxTasksPerProject: 10000,
    maxStorageMb: 10000,
    features: [
      "basic_boards",
      "basic_tasks",
      "comments",
      "activity_log",
      "advanced_analytics",
      "custom_fields",
      "file_attachments",
      "priority_support",
      "export_data",
      "api_access",
      "webhooks",
    ],
    priceMonthly: 1200, // $12/month
    priceYearly: 11520, // $9.60/month billed yearly
  },

  enterprise: {
    name: "enterprise",
    displayName: "Enterprise",
    maxMembers: -1,
    maxProjects: -1,
    maxTasksPerProject: -1,
    maxStorageMb: -1,
    features: [
      "basic_boards",
      "basic_tasks",
      "comments",
      "activity_log",
      "advanced_analytics",
      "custom_fields",
      "file_attachments",
      "priority_support",
      "export_data",
      "api_access",
      "webhooks",
      "sso",
      "audit_log",
      "advanced_permissions",
      "sla",
      "dedicated_support",
      "custom_branding",
      "data_residency",
    ],
    priceMonthly: 4900, // $49/month
    priceYearly: 47040, // $39.20/month billed yearly
  },
};

export function getPlanDefinition(plan: string): PlanDefinition {
  const def = PLAN_DEFINITIONS[plan];
  if (!def) {
    return PLAN_DEFINITIONS["free"]!;
  }
  return def;
}

/**
 * Check if a limit is exceeded. Returns true if OVER the limit.
 * -1 = unlimited (never exceeded).
 */
export function isLimitExceeded(current: number, limit: number): boolean {
  if (limit === -1) return false;
  return current >= limit;
}
