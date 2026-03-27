import { Router } from "express";
import { cardController } from "../controllers/cardController.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { cardSchema, moveCardSchema } from "../dto/schemas.js";
const router = Router();
router.post("/", authRequired, requireRole(["ADMIN", "MEMBER"]), validate(cardSchema), cardController.create);
router.patch("/:cardId/move", authRequired, requireRole(["ADMIN", "MEMBER"]), validate(moveCardSchema), cardController.move);
export default router;
