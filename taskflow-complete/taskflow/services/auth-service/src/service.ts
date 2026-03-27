import { createHash, randomUUID } from "node:crypto";
import { query, transaction } from "@taskflow/db";
import {
  generateId,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  createLogger,
} from "@taskflow/utils";
import { hashPassword, comparePassword } from "./password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./tokens.js";
import type {
  RegisterTenantInput,
  RegisterUserInput,
  LoginInput,
} from "./schemas.js";

const logger = createLogger("auth-service:service");

// Hash refresh token for storage (never store raw tokens)
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Register Tenant + Owner ────────────────────────────────
export async function registerTenant(input: RegisterTenantInput) {
  return transaction(async (client) => {
    // Check slug uniqueness
    const { rows: existing } = await client.query(
      "SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL",
      [input.tenantSlug]
    );
    if (existing.length > 0) {
      throw new ConflictError(`Tenant slug '${input.tenantSlug}' is already taken`);
    }

    // Check email uniqueness
    const { rows: existingUser } = await client.query(
      "SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
      [input.email]
    );
    if (existingUser.length > 0) {
      throw new ConflictError(`Email '${input.email}' is already registered`);
    }

    // Create tenant
    const tenantId = generateId();
    await client.query(
      `INSERT INTO tenants (id, name, slug, plan)
       VALUES ($1, $2, $3, 'free')`,
      [tenantId, input.tenantName, input.tenantSlug]
    );

    // Create user
    const userId = generateId();
    const pwHash = await hashPassword(input.password);
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4)`,
      [userId, input.email, pwHash, input.fullName]
    );

    // Create owner membership
    await client.query(
      `INSERT INTO memberships (tenant_id, user_id, role, accepted_at)
       VALUES ($1, $2, 'owner', NOW())`,
      [tenantId, userId]
    );

    // Create free subscription
    await client.query(
      `INSERT INTO subscriptions (tenant_id, plan, status, current_period_start)
       VALUES ($1, 'free', 'active', NOW())`,
      [tenantId]
    );

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokenPair(
      client,
      userId,
      tenantId,
      input.email,
      "owner"
    );

    logger.info({ tenantId, userId }, "Tenant registered");

    return {
      tenant: { id: tenantId, name: input.tenantName, slug: input.tenantSlug },
      user: { id: userId, email: input.email, fullName: input.fullName },
      accessToken,
      refreshToken,
    };
  });
}

// ─── Register User (join existing tenant) ───────────────────
export async function registerUser(input: RegisterUserInput) {
  return transaction(async (client) => {
    // Verify tenant exists
    const { rows: tenants } = await client.query(
      "SELECT id, name, slug FROM tenants WHERE id = $1 AND deleted_at IS NULL",
      [input.tenantId]
    );
    if (tenants.length === 0) {
      throw new NotFoundError("Tenant", input.tenantId);
    }

    // Check email uniqueness
    const { rows: existingUser } = await client.query(
      "SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
      [input.email]
    );
    if (existingUser.length > 0) {
      throw new ConflictError(`Email '${input.email}' is already registered`);
    }

    // If invite code provided, validate it
    let role = "member";
    if (input.inviteCode) {
      const { rows: invites } = await client.query(
        `SELECT id, role FROM memberships
         WHERE tenant_id = $1 AND invite_code = $2
         AND accepted_at IS NULL AND deleted_at IS NULL`,
        [input.tenantId, input.inviteCode]
      );
      if (invites.length === 0) {
        throw new UnauthorizedError("Invalid or expired invite code");
      }
      role = invites[0]!.role;

      // Mark invite as accepted
      await client.query(
        "UPDATE memberships SET accepted_at = NOW() WHERE id = $1",
        [invites[0]!.id]
      );
    }

    // Create user
    const userId = generateId();
    const pwHash = await hashPassword(input.password);
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4)`,
      [userId, input.email, pwHash, input.fullName]
    );

    // Create membership (if no invite, create new membership)
    if (!input.inviteCode) {
      await client.query(
        `INSERT INTO memberships (tenant_id, user_id, role, accepted_at)
         VALUES ($1, $2, $3, NOW())`,
        [input.tenantId, userId, role]
      );
    } else {
      // Update the invite membership with the user_id
      await client.query(
        `UPDATE memberships SET user_id = $1
         WHERE tenant_id = $2 AND invite_code = $3`,
        [userId, input.tenantId, input.inviteCode]
      );
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokenPair(
      client,
      userId,
      input.tenantId,
      input.email,
      role
    );

    logger.info({ tenantId: input.tenantId, userId }, "User registered");

    return {
      user: { id: userId, email: input.email, fullName: input.fullName },
      accessToken,
      refreshToken,
    };
  });
}

// ─── Login ──────────────────────────────────────────────────
export async function login(input: LoginInput) {
  // Find tenant by slug
  const { rows: tenants } = await query(
    "SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL",
    [input.tenantSlug]
  );
  if (tenants.length === 0) {
    throw new UnauthorizedError("Invalid credentials");
  }
  const tenantId = tenants[0]!.id;

  // Find user by email
  const { rows: users } = await query(
    "SELECT id, email, password_hash, full_name, is_active FROM users WHERE email = $1 AND deleted_at IS NULL",
    [input.email]
  );
  if (users.length === 0) {
    throw new UnauthorizedError("Invalid credentials");
  }
  const user = users[0]!;

  if (!user.is_active) {
    throw new UnauthorizedError("Account is deactivated");
  }

  // Verify password
  const valid = await comparePassword(input.password, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  // Verify membership
  const { rows: memberships } = await query(
    `SELECT role FROM memberships
     WHERE tenant_id = $1 AND user_id = $2
     AND accepted_at IS NOT NULL AND deleted_at IS NULL`,
    [tenantId, user.id]
  );
  if (memberships.length === 0) {
    throw new UnauthorizedError("You are not a member of this workspace");
  }
  const role = memberships[0]!.role;

  // Generate tokens
  const result = await transaction(async (client) => {
    return generateTokenPair(client, user.id, tenantId, user.email, role);
  });

  logger.info({ tenantId, userId: user.id }, "User logged in");

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role,
    },
    tenantId,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  };
}

// ─── Refresh Token (with rotation + reuse detection) ────────
export async function refresh(rawRefreshToken: string) {
  // Verify JWT signature
  verifyRefreshToken(rawRefreshToken);
  const tokenHash = hashToken(rawRefreshToken);

  return transaction(async (client) => {
    // Look up stored token
    const { rows: tokens } = await client.query(
      `SELECT id, user_id, tenant_id, family_id, is_revoked, expires_at
       FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );

    if (tokens.length === 0) {
      throw new UnauthorizedError("Refresh token not found");
    }

    const storedToken = tokens[0]!;

    // ─── REUSE DETECTION ────────────────────────────────
    // If the token is already revoked, someone may have stolen it.
    // Revoke the ENTIRE family to protect the user.
    if (storedToken.is_revoked) {
      logger.warn(
        { familyId: storedToken.family_id, userId: storedToken.user_id },
        "Refresh token reuse detected! Revoking entire family."
      );
      await client.query(
        "UPDATE refresh_tokens SET is_revoked = true WHERE family_id = $1",
        [storedToken.family_id]
      );
      throw new UnauthorizedError(
        "Refresh token reuse detected. All sessions revoked for security."
      );
    }

    // Check expiry
    if (new Date(storedToken.expires_at) < new Date()) {
      throw new UnauthorizedError("Refresh token expired");
    }

    // Revoke current token
    await client.query(
      "UPDATE refresh_tokens SET is_revoked = true WHERE id = $1",
      [storedToken.id]
    );

    // Get user info for new access token
    const { rows: users } = await client.query(
      "SELECT email, full_name FROM users WHERE id = $1 AND deleted_at IS NULL",
      [storedToken.user_id]
    );
    if (users.length === 0) {
      throw new UnauthorizedError("User not found");
    }

    // Get role
    const { rows: memberships } = await client.query(
      `SELECT role FROM memberships
       WHERE tenant_id = $1 AND user_id = $2
       AND accepted_at IS NOT NULL AND deleted_at IS NULL`,
      [storedToken.tenant_id, storedToken.user_id]
    );
    const role = memberships[0]?.role ?? "member";

    // Generate new token pair (same family)
    const { accessToken, refreshToken: newRefreshToken } =
      await generateTokenPairWithFamily(
        client,
        storedToken.user_id,
        storedToken.tenant_id,
        users[0]!.email,
        role,
        storedToken.family_id,
        storedToken.id
      );

    logger.info(
      { userId: storedToken.user_id, tenantId: storedToken.tenant_id },
      "Token refreshed"
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: storedToken.user_id,
        email: users[0]!.email,
        fullName: users[0]!.full_name,
        role,
      },
      tenantId: storedToken.tenant_id,
    };
  });
}

// ─── Logout (revoke refresh token) ─────────────────────────
export async function logout(rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);

  const { rowCount } = await query(
    "UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1 AND is_revoked = false",
    [tokenHash]
  );

  if (rowCount === 0) {
    logger.warn("Logout attempted with unknown/revoked token");
  } else {
    logger.info("User logged out, refresh token revoked");
  }
}

// ─── Token generation helpers ───────────────────────────────

async function generateTokenPair(
  client: import("pg").PoolClient,
  userId: string,
  tenantId: string,
  email: string,
  role: string
) {
  const familyId = randomUUID();
  return generateTokenPairWithFamily(
    client,
    userId,
    tenantId,
    email,
    role,
    familyId,
    null
  );
}

async function generateTokenPairWithFamily(
  client: import("pg").PoolClient,
  userId: string,
  tenantId: string,
  email: string,
  role: string,
  familyId: string,
  replacedBy: string | null
) {
  const tokenId = generateId();

  // Sign access token
  const accessToken = signAccessToken({ userId, tenantId, email, role });

  // Sign refresh token
  const refreshToken = signRefreshToken({
    userId,
    tenantId,
    familyId,
    tokenId,
  });

  // Store refresh token hash
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await client.query(
    `INSERT INTO refresh_tokens (id, user_id, tenant_id, token_hash, family_id, expires_at, replaced_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [tokenId, userId, tenantId, tokenHash, familyId, expiresAt, replacedBy]
  );

  // Update replaced_by on old token if rotating
  if (replacedBy) {
    await client.query(
      "UPDATE refresh_tokens SET replaced_by = $1 WHERE id = $2",
      [tokenId, replacedBy]
    );
  }

  return { accessToken, refreshToken };
}

// ─── Get current user profile ───────────────────────────────
export async function getProfile(userId: string, tenantId: string) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.avatar_url, u.created_at,
            m.role
     FROM users u
     JOIN memberships m ON m.user_id = u.id AND m.tenant_id = $2
     WHERE u.id = $1 AND u.deleted_at IS NULL AND m.deleted_at IS NULL`,
    [userId, tenantId]
  );
  if (rows.length === 0) {
    throw new NotFoundError("User", userId);
  }
  return rows[0];
}
