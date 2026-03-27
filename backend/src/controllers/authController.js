import bcrypt from "bcryptjs";
import createError from "http-errors";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens.js";

function buildTokens(user, organizationId, role) {
  const payload = { sub: user.id, organizationId, role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });
    if (!user) throw createError(401, "Invalid credentials");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw createError(401, "Invalid credentials");
    const membership = user.memberships[0];
    const tokens = buildTokens(user, membership.organizationId, membership.role);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
    });
    res.json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const decoded = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { memberships: true },
    });
    if (!user?.refreshToken) throw createError(401, "Invalid refresh token");
    const valid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!valid) throw createError(401, "Invalid refresh token");
    const membership = user.memberships[0];
    const tokens = buildTokens(user, membership.organizationId, membership.role);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
    });
    res.json(tokens);
  } catch (err) {
    next(createError(401, "Refresh failed"));
  }
}

export async function me(req, res) {
  res.json({ user: req.user });
}
