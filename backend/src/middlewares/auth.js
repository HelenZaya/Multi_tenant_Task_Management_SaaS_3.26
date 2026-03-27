import createError from "http-errors";
import { verifyAccessToken } from "../utils/tokens.js";
import { prisma } from "../lib/prisma.js";

export async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw createError(401, "Missing token");
    const token = header.slice(7);
    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        memberships: {
          include: { organization: true },
          take: 1,
        },
      },
    });
    if (!user) throw createError(401, "Invalid token");
    const membership = user.memberships[0];
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership?.organizationId,
      role: membership?.role,
    };
    next();
  } catch (error) {
    next(createError(401, "Unauthorized"));
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(createError(403, "Forbidden"));
    }
    next();
  };
}
