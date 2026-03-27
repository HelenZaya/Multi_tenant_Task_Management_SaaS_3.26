import type { Request, Response, NextFunction } from "express";
import { userService } from "../services/userService.js";

export const userController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await userService.listUsers(req.auth!.tenantId);
      res.json({ users });
    } catch (error) {
      next(error);
    }
  }
};
