import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { inviteSchema, loginSchema, refreshSchema, registerSchema } from "../dto/schemas.js";
const router = Router();
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new tenant admin
 */
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.get("/me", authRequired, authController.me);
router.post("/invite", authRequired, requireRole(["ADMIN"]), validate(inviteSchema), authController.invite);
export default router;
