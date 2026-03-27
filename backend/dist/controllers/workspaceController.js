import { workspaceService } from "../services/workspaceService.js";
export const workspaceController = {
    async list(req, res, next) {
        try {
            const workspaces = await workspaceService.listWorkspaces(req.auth.tenantId);
            res.json({ workspaces });
        }
        catch (error) {
            next(error);
        }
    },
    async create(req, res, next) {
        try {
            const workspace = await workspaceService.createWorkspace(req.auth.tenantId, req.body.name, req.auth.userId);
            res.status(201).json({ workspace });
        }
        catch (error) {
            next(error);
        }
    }
};
