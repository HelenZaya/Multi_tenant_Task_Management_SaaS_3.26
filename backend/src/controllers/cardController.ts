import type { Request, Response, NextFunction } from "express";
import { cardService } from "../services/cardService.js";

export const cardController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const card = await cardService.createCard({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, ...req.body });
      res.status(201).json({ card });
    } catch (error) {
      next(error);
    }
  },
  async move(req: Request, res: Response, next: NextFunction) {
    try {
      const card = await cardService.moveCard({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, cardId: req.params.cardId, ...req.body });
      res.json({ card });
    } catch (error) {
      next(error);
    }
  }
};
