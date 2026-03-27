import { randomUUID, randomBytes } from "node:crypto";

export function generateId(): string {
  return randomUUID();
}

export function generateShortId(length: number = 12): string {
  return randomBytes(length).toString("base64url").slice(0, length);
}

export function generateInviteCode(): string {
  return randomBytes(24).toString("base64url");
}
