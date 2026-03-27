import { validationResult } from "express-validator";
import createError from "http-errors";

export function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return next(createError(400, result.array().map(e => e.msg).join(", ")));
  }
  next();
}
