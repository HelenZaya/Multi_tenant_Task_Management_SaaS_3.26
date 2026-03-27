import { Router } from "express";
import { boardController } from "../controllers/boardController.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { boardSchema } from "../dto/schemas.js";

const router = Router();

router.get("/", authRequired, boardController.list);
router.get("/summary", authRequired, boardController.summary);
router.get("/:boardId", authRequired, boardController.get);
router.post("/", authRequired, requireRole(["ADMIN", "MEMBER"]), validate(boardSchema), boardController.create);

export default router;
