import { Router } from "express";
import { body } from "express-validator";
import { login, me, refresh } from "../controllers/authController.js";
import { authRequired } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = Router();

router.post("/login", [
  body("email").isEmail(),
  body("password").isLength({ min: 8 }),
  validate
], login);

router.post("/refresh", [
  body("refreshToken").isString().notEmpty(),
  validate
], refresh);

router.get("/me", authRequired, me);

export default router;
