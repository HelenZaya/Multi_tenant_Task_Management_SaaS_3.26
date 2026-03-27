import { userRepository } from "../repositories/userRepository.js";

export const userService = {
  async listUsers(tenantId: string) {
    const memberships = await userRepository.getTenantUsers(tenantId);
    return memberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role
    }));
  }
};
