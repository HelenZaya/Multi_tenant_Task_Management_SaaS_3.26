import { cardService } from "../services/cardService.js";
export const cardController = {
    async create(req, res, next) {
        try {
            const card = await cardService.createCard({ tenantId: req.auth.tenantId, actorId: req.auth.userId, ...req.body });
            res.status(201).json({ card });
        }
        catch (error) {
            next(error);
        }
    },
    async move(req, res, next) {
        try {
            const card = await cardService.moveCard({ tenantId: req.auth.tenantId, actorId: req.auth.userId, cardId: req.params.cardId, ...req.body });
            res.json({ card });
        }
        catch (error) {
            next(error);
        }
    }
};
