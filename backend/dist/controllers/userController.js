import { userService } from "../services/userService.js";
export const userController = {
    async list(req, res, next) {
        try {
            const users = await userService.listUsers(req.auth.tenantId);
            res.json({ users });
        }
        catch (error) {
            next(error);
        }
    }
};
