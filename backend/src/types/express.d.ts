import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        userId: string;
        tenantId: string;
        role: Role;
        jti?: string;
      };
    }
  }
}

export {};
