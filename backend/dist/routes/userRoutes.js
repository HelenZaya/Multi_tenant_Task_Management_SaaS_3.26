import { Router } from "express";
import { userController } from "../controllers/userController.js";
import { authRequired } from "../middleware/auth.js";
const router = Router();
router.get("/", authRequired, userController.list);
export default router;
