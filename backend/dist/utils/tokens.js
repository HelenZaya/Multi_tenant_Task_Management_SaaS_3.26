import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";
export function signAccessToken(payload) {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
        expiresIn: env.ACCESS_TOKEN_TTL
    });
}
export function signRefreshToken(payload) {
    const jti = uuidv4();
    return {
        jti,
        token: jwt.sign({ ...payload, jti }, env.JWT_REFRESH_SECRET, {
            expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`
        })
    };
}
export function verifyAccessToken(token) {
    return jwt.verify(token, env.JWT_ACCESS_SECRET);
}
export function verifyRefreshToken(token) {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
