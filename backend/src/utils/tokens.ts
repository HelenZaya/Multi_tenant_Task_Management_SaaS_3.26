import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";

type TokenPayload = {
  sub: string;
  tenantId: string;
  role: string;
  jti?: string;
};

export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET as jwt.Secret, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"]
  });
}

export function signRefreshToken(payload: TokenPayload) {
  const jti = uuidv4();
  return {
    jti,
    token: jwt.sign({ ...payload, jti }, env.JWT_REFRESH_SECRET as jwt.Secret, {
      expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as jwt.SignOptions["expiresIn"]
    })
  };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET as jwt.Secret) as TokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET as jwt.Secret) as TokenPayload;
}
