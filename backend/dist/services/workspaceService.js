import { workspaceRepository } from "../repositories/workspaceRepository.js";
export const workspaceService = {
    listWorkspaces(tenantId) {
        return workspaceRepository.listWorkspaces(tenantId);
    },
    createWorkspace(tenantId, name, actorId) {
        return workspaceRepository.createWorkspace(tenantId, name, actorId);
    }
};
