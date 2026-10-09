import type { NextFunction, Request, RequestHandler, Response } from "express";
import { authErrors } from "../errors/AppError.js";

/// Gates actions that require a confirmed email address (e.g. placing an
/// order, submitting a review) without blocking login/browsing for
/// unverified customers. Staff accounts are already blocked at login time
/// until verified (see auth.service.ts), so this only matters for customers.
export const requireVerifiedEmail: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth) {
    next(authErrors.unauthorized());
    return;
  }
  if (!req.auth.emailVerified) {
    next(authErrors.emailNotVerified());
    return;
  }
  next();
};
