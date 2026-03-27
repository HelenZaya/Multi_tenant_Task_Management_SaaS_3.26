import { boardService } from "../services/boardService.js";
export const boardController = {
    async list(req, res, next) {
        try {
            const boards = await boardService.listBoards(req.auth.tenantId);
            res.json({ boards });
        }
        catch (error) {
            next(error);
        }
    },
    async get(req, res, next) {
        try {
            const board = await boardService.getBoard(req.auth.tenantId, String(req.params.boardId));
            res.json({ board });
        }
        catch (error) {
            next(error);
        }
    },
    async create(req, res, next) {
        try {
            const board = await boardService.createBoard(req.auth.tenantId, req.body.workspaceId, req.body.name, req.auth.userId);
            res.status(201).json({ board });
        }
        catch (error) {
            next(error);
        }
    },
    async summary(req, res, next) {
        try {
            const summary = await boardService.dashboardSummary(req.auth.tenantId);
            res.json(summary);
        }
        catch (error) {
            next(error);
        }
    }
};
