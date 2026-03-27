import bcrypt from "bcryptjs";
import createError from "http-errors";
import { env } from "../config/env.js";
import { authRepository } from "../repositories/authRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { emailQueue } from "../lib/queue.js";
import { publishDomainEvent } from "../lib/events.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens.js";

export const authService = {
  async register(input: { name: string; email: string; password: string; tenantName: string; tenantSlug: string }) {
    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) {
      throw createError(409, "Email already exists");
    }
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    const { user, tenant } = await authRepository.createTenantWithAdmin({
      name: input.name,
      email: input.email,
      passwordHash,
      tenantName: input.tenantName,
      tenantSlug: input.tenantSlug
    });
    await authRepository.writeAuditLog(tenant.id, user.id, "auth.registered", "tenant", tenant.id, { email: input.email });
    return this.issueTokens(user.id, tenant.id, "ADMIN");
  },

  async login(input: { email: string; password: string }) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      throw createError(401, "Invalid credentials");
    }
    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      throw createError(401, "Invalid credentials");
    }
    const membership = user.memberships[0];
    if (!membership) {
      throw createError(403, "No active tenant membership");
    }
    return this.issueTokens(user.id, membership.tenantId, membership.role);
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload.jti) {
      throw createError(401, "Invalid refresh token");
    }
    const stored = await authRepository.findRefreshToken(payload.jti);
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw createError(401, "Refresh token revoked");
    }
    const valid = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!valid) {
      throw createError(401, "Refresh token mismatch");
    }
    const rotated = await this.issueTokens(payload.sub, payload.tenantId, payload.role);
    await authRepository.revokeRefreshToken(payload.jti, rotated.refreshJti);
    return rotated;
  },

  async me(userId: string, tenantId: string) {
    const user = await authRepository.findUserById(userId);
    const membership = user?.memberships.find((item) => item.tenantId === tenantId);
    if (!user || !membership) {
      throw createError(404, "User not found");
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId,
      tenantName: membership.tenant.name,
      role: membership.role
    };
  },

  async inviteUser(input: { tenantId: string; actorId: string; email: string; role: "ADMIN" | "MEMBER" | "VIEWER"; name?: string }) {
    const user = await userRepository.findOrCreateUserByEmail(input.email, input.name ?? input.email.split("@")[0] ?? "Invited User");
    await authRepository.createInvitationMembership({
      tenantId: input.tenantId,
      userId: user.id,
      role: input.role,
      invitedById: input.actorId
    });
    await emailQueue.add("user.invited", { email: input.email, tenantId: input.tenantId, role: input.role });
    await publishDomainEvent(input.tenantId, "user.invited", { email: input.email, role: input.role });
    await authRepository.writeAuditLog(input.tenantId, input.actorId, "user.invited", "user", user.id, { email: input.email, role: input.role });
    return user;
  },

  async issueTokens(userId: string, tenantId: string, role: string) {
    const accessToken = signAccessToken({ sub: userId, tenantId, role });
    const refresh = signRefreshToken({ sub: userId, tenantId, role });
    const tokenHash = await bcrypt.hash(refresh.token, env.BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await authRepository.createRefreshToken({ jti: refresh.jti, userId, tenantId, tokenHash, expiresAt });
    return { accessToken, refreshToken: refresh.token, refreshJti: refresh.jti };
  }
};
