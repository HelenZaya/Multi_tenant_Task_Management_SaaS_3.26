import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { getSummary } from "../controllers/dashboardController.js";

const router = Router();
router.get("/summary", authRequired, getSummary);
export default router;
