import {
  queryWithTenant,
  query,
  cacheGet,
  cacheSet,
  cacheDel,
  publish,
} from "@taskflow/db";
import {
  generateId,
  generateInviteCode,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  createLogger,
  DOMAIN_EVENTS,
  type DomainEvent,
} from "@taskflow/utils";
import type {
  UpdateTenantInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  ListMembersQuery,
} from "./schemas.js";

const logger = createLogger("tenant-service:service");

// ─── Get Tenant ─────────────────────────────────────────────
export async function getTenant(tenantId: string) {
  // Check cache first
  const cached = await cacheGet<Record<string, unknown>>(`tenant:${tenantId}`);
  if (cached) return cached;

  const { rows } = await query(
    `SELECT id, name, slug, plan, settings, created_at, updated_at
     FROM tenants WHERE id = $1 AND deleted_at IS NULL`,
    [tenantId]
  );
  if (rows.length === 0) {
    throw new NotFoundError("Tenant", tenantId);
  }

  await cacheSet(`tenant:${tenantId}`, rows[0], 600);
  return rows[0];
}

// ─── Update Tenant ──────────────────────────────────────────
export async function updateTenant(
  tenantId: string,
  userId: string,
  input: UpdateTenantInput
) {
  // Verify admin/owner
  await requireRole(tenantId, userId, ["owner", "admin"]);

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    values.push(input.name);
  }
  if (input.settings !== undefined) {
    setClauses.push(`settings = settings || $${idx++}::jsonb`);
    values.push(JSON.stringify(input.settings));
  }

  if (setClauses.length === 0) {
    return getTenant(tenantId);
  }

  values.push(tenantId);
  const { rows } = await query(
    `UPDATE tenants SET ${setClauses.join(", ")}, updated_at = NOW()
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING id, name, slug, plan, settings, created_at, updated_at`,
    values
  );

  if (rows.length === 0) {
    throw new NotFoundError("Tenant", tenantId);
  }

  await cacheDel(`tenant:${tenantId}`);
  logger.info({ tenantId }, "Tenant updated");
  return rows[0];
}

// ─── List Members ───────────────────────────────────────────
export async function listMembers(
  tenantId: string,
  queryParams: ListMembersQuery
) {
  const { page, limit, role } = queryParams;
  const offset = (page - 1) * limit;

  let whereClause = "m.tenant_id = $1 AND m.deleted_at IS NULL";
  const values: unknown[] = [tenantId];
  let idx = 2;

  if (role) {
    whereClause += ` AND m.role = $${idx++}`;
    values.push(role);
  }

  // Count
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM memberships m WHERE ${whereClause}`,
    values
  );
  const total = countRows[0]?.total ?? 0;

  // Fetch with user join
  const { rows } = await query(
    `SELECT m.id, m.user_id, m.role, m.accepted_at, m.created_at,
            u.email, u.full_name, u.avatar_url
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE ${whereClause}
     ORDER BY m.created_at ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  return { members: rows, total, page, limit };
}

// ─── Invite Member ──────────────────────────────────────────
export async function inviteMember(
  tenantId: string,
  invitedByUserId: string,
  input: InviteMemberInput
) {
  await requireRole(tenantId, invitedByUserId, ["owner", "admin"]);

  // Check if user already exists
  const { rows: existingUsers } = await query(
    "SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
    [input.email]
  );

  const inviteCode = generateInviteCode();
  const membershipId = generateId();

  if (existingUsers.length > 0) {
    const userId = existingUsers[0]!.id;

    // Check if already a member
    const { rows: existingMemberships } = await queryWithTenant(
      tenantId,
      `SELECT id FROM memberships
       WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (existingMemberships.length > 0) {
      throw new ConflictError("User is already a member of this workspace");
    }

    // Create membership with accepted (existing user auto-joins)
    await queryWithTenant(
      tenantId,
      `INSERT INTO memberships (id, tenant_id, user_id, role, invited_by, invite_code, accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [membershipId, tenantId, userId, input.role, invitedByUserId, inviteCode]
    );
  } else {
    // Create placeholder membership for non-existing user
    // They'll claim it when they register with the invite code
    // Use a placeholder user_id (the inviter) — will be updated on accept
    await queryWithTenant(
      tenantId,
      `INSERT INTO memberships (id, tenant_id, user_id, role, invited_by, invite_code)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [membershipId, tenantId, invitedByUserId, input.role, invitedByUserId, inviteCode]
    );
  }

  // Publish event
  const event: DomainEvent = {
    id: generateId(),
    type: DOMAIN_EVENTS.USER_INVITED,
    tenantId,
    userId: invitedByUserId,
    payload: {
      email: input.email,
      role: input.role,
      inviteCode,
      membershipId,
    },
    timestamp: new Date().toISOString(),
  };
  await publish("domain.events", event);

  logger.info({ tenantId, email: input.email, role: input.role }, "Member invited");

  return {
    id: membershipId,
    email: input.email,
    role: input.role,
    inviteCode,
    accepted: existingUsers.length > 0,
  };
}

// ─── Update Member Role ─────────────────────────────────────
export async function updateMemberRole(
  tenantId: string,
  requesterId: string,
  membershipId: string,
  input: UpdateMemberRoleInput
) {
  await requireRole(tenantId, requesterId, ["owner", "admin"]);

  // Cannot change owner role
  const { rows: target } = await queryWithTenant(
    tenantId,
    "SELECT id, user_id, role FROM memberships WHERE id = $1 AND deleted_at IS NULL",
    [membershipId]
  );
  if (target.length === 0) {
    throw new NotFoundError("Membership", membershipId);
  }
  if (target[0]!.role === "owner") {
    throw new ForbiddenError("Cannot change the owner's role");
  }

  // Admins cannot promote to admin (only owner can)
  const requesterRole = await getMemberRole(tenantId, requesterId);
  if (requesterRole === "admin" && input.role === "admin") {
    throw new ForbiddenError("Only owners can promote members to admin");
  }

  const { rows } = await queryWithTenant(
    tenantId,
    `UPDATE memberships SET role = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, user_id, role, updated_at`,
    [input.role, membershipId]
  );

  logger.info({ tenantId, membershipId, newRole: input.role }, "Member role updated");
  return rows[0];
}

// ─── Remove Member ──────────────────────────────────────────
export async function removeMember(
  tenantId: string,
  requesterId: string,
  membershipId: string
) {
  await requireRole(tenantId, requesterId, ["owner", "admin"]);

  const { rows: target } = await queryWithTenant(
    tenantId,
    "SELECT id, user_id, role FROM memberships WHERE id = $1 AND deleted_at IS NULL",
    [membershipId]
  );
  if (target.length === 0) {
    throw new NotFoundError("Membership", membershipId);
  }
  if (target[0]!.role === "owner") {
    throw new ForbiddenError("Cannot remove the workspace owner");
  }
  if (target[0]!.user_id === requesterId) {
    throw new ForbiddenError("Cannot remove yourself. Use leave instead.");
  }

  await queryWithTenant(
    tenantId,
    "UPDATE memberships SET deleted_at = NOW() WHERE id = $1",
    [membershipId]
  );

  // Publish event
  const event: DomainEvent = {
    id: generateId(),
    type: DOMAIN_EVENTS.MEMBER_REMOVED,
    tenantId,
    userId: requesterId,
    payload: { membershipId, removedUserId: target[0]!.user_id },
    timestamp: new Date().toISOString(),
  };
  await publish("domain.events", event);

  logger.info({ tenantId, membershipId }, "Member removed");
}

// ─── Leave Workspace ────────────────────────────────────────
export async function leaveWorkspace(tenantId: string, userId: string) {
  const role = await getMemberRole(tenantId, userId);
  if (role === "owner") {
    throw new ForbiddenError(
      "Owner cannot leave. Transfer ownership first."
    );
  }

  await queryWithTenant(
    tenantId,
    `UPDATE memberships SET deleted_at = NOW()
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  logger.info({ tenantId, userId }, "User left workspace");
}

// ─── Get user's tenants ─────────────────────────────────────
export async function getUserTenants(userId: string) {
  const { rows } = await query(
    `SELECT t.id, t.name, t.slug, t.plan, m.role, t.created_at
     FROM tenants t
     JOIN memberships m ON m.tenant_id = t.id
     WHERE m.user_id = $1 AND m.accepted_at IS NOT NULL
     AND m.deleted_at IS NULL AND t.deleted_at IS NULL
     ORDER BY t.created_at ASC`,
    [userId]
  );
  return rows;
}

// ─── Helpers ────────────────────────────────────────────────

async function getMemberRole(
  tenantId: string,
  userId: string
): Promise<string> {
  const { rows } = await queryWithTenant(
    tenantId,
    `SELECT role FROM memberships
     WHERE user_id = $1 AND accepted_at IS NOT NULL AND deleted_at IS NULL`,
    [userId]
  );
  if (rows.length === 0) {
    throw new ForbiddenError("Not a member of this workspace");
  }
  return rows[0]!.role;
}

async function requireRole(
  tenantId: string,
  userId: string,
  allowedRoles: string[]
): Promise<void> {
  const role = await getMemberRole(tenantId, userId);
  if (!allowedRoles.includes(role)) {
    throw new ForbiddenError(
      `This action requires one of: ${allowedRoles.join(", ")}`
    );
  }
}
