import { Router } from "express";
import { reportController } from "../controllers/reportController.js";
import { authRequired, requireRole } from "../middleware/auth.js";
const router = Router();
router.get("/", authRequired, reportController.snapshot);
router.post("/generate", authRequired, requireRole(["ADMIN", "MEMBER"]), reportController.generate);
export default router;
