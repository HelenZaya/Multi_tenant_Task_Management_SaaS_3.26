import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { getBoard, getBoards } from "../controllers/boardController.js";

const router = Router();
router.get("/", authRequired, getBoards);
router.get("/:boardId", authRequired, getBoard);
export default router;
