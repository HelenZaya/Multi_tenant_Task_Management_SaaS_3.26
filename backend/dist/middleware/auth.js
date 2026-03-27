import createError from "http-errors";
import { verifyAccessToken } from "../utils/tokens.js";
export function authRequired(req, _res, next) {
    try {
        const header = req.headers.authorization;
        const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
        if (!token) {
            throw createError(401, "Missing bearer token");
        }
        const payload = verifyAccessToken(token);
        req.auth = {
            userId: payload.sub,
            tenantId: payload.tenantId,
            role: payload.role,
            jti: payload.jti
        };
        next();
    }
    catch {
        next(createError(401, "Unauthorized"));
    }
}
export function requireRole(roles) {
    return (req, _res, next) => {
        if (!req.auth || !roles.includes(req.auth.role)) {
            return next(createError(403, "Forbidden"));
        }
        next();
    };
}
