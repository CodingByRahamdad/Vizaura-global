import type { NextFunction, Request, Response } from "express";
import { CheckoutService } from "./checkout.service.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors, checkoutErrors } from "../../errors/AppError.js";
import type { CheckoutInput, CheckoutQuery } from "./checkout.validators.js";

const checkoutService = new CheckoutService();

const IDEMPOTENCY_HEADER = "Idempotency-Key";

/// Cart/order ownership is always resolved against the authenticated
/// caller's own userId — never a client-supplied id. `authenticate` (not
/// `optionalAuthenticate`) is required in checkout.routes.ts, so req.auth
/// is always present here.
function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

/// Headers aren't covered by the shared `validate()` middleware (body/
/// query/params only), so the required Idempotency-Key header is checked
/// here directly.
function requireIdempotencyKey(req: Request): string {
  const key = req.get(IDEMPOTENCY_HEADER)?.trim();
  if (!key) {
    throw checkoutErrors.validation({
      fields: [{ path: IDEMPOTENCY_HEADER, message: "This header is required." }],
    });
  }
  return key;
}

export async function checkout(req: Request, res: Response, next: NextFunction) {
  try {
    const { market } = req.query as unknown as CheckoutQuery;
    const idempotencyKey = requireIdempotencyKey(req);
    const userId = requireUserId(req);
    const { order, isReplay } = await checkoutService.checkout(userId, market, idempotencyKey, req.body as CheckoutInput);
    res.status(isReplay ? 200 : 201).json(successResponse(order));
  } catch (error) {
    next(error);
  }
}
