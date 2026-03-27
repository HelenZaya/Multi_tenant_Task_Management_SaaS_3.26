import createError from "http-errors";
import { cacheKeys, getCached, invalidateCache, setCached } from "../lib/cache.js";
import { boardRepository } from "../repositories/boardRepository.js";
export const boardService = {
    listBoards(tenantId) {
        return boardRepository.listBoards(tenantId);
    },
    async getBoard(tenantId, boardId) {
        const key = cacheKeys.board(tenantId, boardId);
        const cached = await getCached(key);
        if (cached)
            return cached;
        const board = await boardRepository.getBoard(tenantId, boardId);
        if (!board)
            throw createError(404, "Board not found");
        await setCached(key, board, 20);
        return board;
    },
    async createBoard(tenantId, workspaceId, name, actorId) {
        const board = await boardRepository.createBoard(tenantId, workspaceId, name, actorId);
        await invalidateCache([cacheKeys.dashboard(tenantId)]);
        return board;
    },
    async dashboardSummary(tenantId) {
        const key = cacheKeys.dashboard(tenantId);
        const cached = await getCached(key);
        if (cached)
            return cached;
        const [workspaces, boards, cards, doneCards, overdueCards] = await boardRepository.dashboardSummary(tenantId);
        const summary = {
            workspaces,
            boards,
            cards,
            doneCards,
            overdueCards,
            completionRate: cards === 0 ? 0 : Math.round((doneCards / cards) * 100)
        };
        await setCached(key, summary, 15);
        return summary;
    }
};
