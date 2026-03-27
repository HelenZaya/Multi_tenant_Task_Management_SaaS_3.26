export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PLANS = {
  FREE: "free",
  PRO: "pro",
  ENTERPRISE: "enterprise",
} as const;

export type Plan = (typeof PLANS)[keyof typeof PLANS];

export const PLAN_LIMITS: Record<
  Plan,
  { maxMembers: number; maxProjects: number; maxTasks: number; maxStorage: number }
> = {
  free: { maxMembers: 5, maxProjects: 3, maxTasks: 100, maxStorage: 100 },
  pro: { maxMembers: 50, maxProjects: 50, maxTasks: 10000, maxStorage: 10000 },
  enterprise: {
    maxMembers: -1,
    maxProjects: -1,
    maxTasks: -1,
    maxStorage: -1,
  }, // unlimited = -1
};

export const TASK_PRIORITY = {
  URGENT: "urgent",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  NONE: "none",
} as const;

export type TaskPriority = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];

export const TASK_STATUS = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  IN_REVIEW: "in_review",
  DONE: "done",
  ARCHIVED: "archived",
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
