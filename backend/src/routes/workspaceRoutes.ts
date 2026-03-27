import { Router } from "express";
import { workspaceController } from "../controllers/workspaceController.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { workspaceSchema } from "../dto/schemas.js";

const router = Router();

router.get("/", authRequired, workspaceController.list);
router.post("/", authRequired, requireRole(["ADMIN", "MEMBER"]), validate(workspaceSchema), workspaceController.create);

export default router;
