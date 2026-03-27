import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { getUsers } from "../controllers/userController.js";

const router = Router();
router.get("/", authRequired, getUsers);
export default router;
