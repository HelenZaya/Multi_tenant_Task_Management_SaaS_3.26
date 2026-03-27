import { prisma } from "../lib/prisma.js";
export const userRepository = {
    getTenantUsers(tenantId) {
        return prisma.membership.findMany({
            where: { tenantId, deletedAt: null, user: { deletedAt: null } },
            include: { user: true },
            orderBy: { createdAt: "asc" }
        });
    },
    findOrCreateUserByEmail(email, fallbackName) {
        return prisma.user.upsert({
            where: { email },
            update: { deletedAt: null, name: fallbackName },
            create: { email, name: fallbackName, passwordHash: "PENDING_INVITE" }
        });
    }
};
