export const DOMAIN_EVENTS = {
  TASK_CREATED: "task.created",
  TASK_UPDATED: "task.updated",
  TASK_MOVED: "task.moved",
  TASK_DELETED: "task.deleted",
  COMMENT_ADDED: "comment.added",
  USER_INVITED: "user.invited",
  USER_JOINED: "user.joined",
  NOTIFICATION_CREATED: "notification.created",
  PROJECT_CREATED: "project.created",
  PROJECT_UPDATED: "project.updated",
  MEMBER_ADDED: "member.added",
  MEMBER_REMOVED: "member.removed",
} as const;

export type DomainEventType =
  (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export interface DomainEvent<T = unknown> {
  id: string;
  type: DomainEventType;
  tenantId: string;
  userId: string;
  payload: T;
  timestamp: string;
  correlationId?: string;
}
