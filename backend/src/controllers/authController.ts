import type { Request, Response, NextFunction } from "express";
import { authService } from "../services/authService.js";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const tokens = await authService.register(req.body);
      res.status(201).json(tokens);
    } catch (error) {
      next(error);
    }
  },
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const tokens = await authService.login(req.body);
      res.json(tokens);
    } catch (error) {
      next(error);
    }
  },
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const tokens = await authService.refresh(req.body.refreshToken);
      res.json(tokens);
    } catch (error) {
      next(error);
    }
  },
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.me(req.auth!.userId, req.auth!.tenantId);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  },
  async invite(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.inviteUser({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, ...req.body });
      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  }
};
