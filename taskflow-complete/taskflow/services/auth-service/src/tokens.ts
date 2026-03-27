import jwt, { type SignOptions } from "jsonwebtoken";
import { getEnv, UnauthorizedError } from "@taskflow/utils";

export interface AccessTokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tenantId: string;
  familyId: string;
  tokenId: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const env = getEnv();
  const expiresIn = env.JWT_ACCESS_EXPIRY as SignOptions["expiresIn"];
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn,
    issuer: "taskflow",
    subject: payload.userId,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const env = getEnv();
  const expiresIn = env.JWT_REFRESH_EXPIRY as SignOptions["expiresIn"];
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn,
    issuer: "taskflow",
    subject: payload.userId,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const env = getEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: "taskflow",
    }) as AccessTokenPayload;
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Access token expired");
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Invalid access token");
    }
    throw new UnauthorizedError("Token verification failed");
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const env = getEnv();
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: "taskflow",
    }) as RefreshTokenPayload;
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Refresh token expired");
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Invalid refresh token");
    }
    throw new UnauthorizedError("Refresh token verification failed");
  }
}

export function decodeToken(token: string): Record<string, unknown> | null {
  const decoded = jwt.decode(token);
  return decoded as Record<string, unknown> | null;
}
