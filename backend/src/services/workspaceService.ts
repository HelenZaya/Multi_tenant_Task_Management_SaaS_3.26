import { workspaceRepository } from "../repositories/workspaceRepository.js";

export const workspaceService = {
  listWorkspaces(tenantId: string) {
    return workspaceRepository.listWorkspaces(tenantId);
  },
  createWorkspace(tenantId: string, name: string, actorId: string) {
    return workspaceRepository.createWorkspace(tenantId, name, actorId);
  }
};
