import { Router } from "express";
import { body } from "express-validator";
import { authRequired, requireRole } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { moveCard } from "../controllers/cardController.js";

const router = Router();

router.patch("/:cardId/move", authRequired, requireRole("ADMIN", "MEMBER"), [
  body("sourceListId").isString().notEmpty(),
  body("targetListId").isString().notEmpty(),
  body("targetCardId").isString().notEmpty(),
  validate
], moveCard);

export default router;
