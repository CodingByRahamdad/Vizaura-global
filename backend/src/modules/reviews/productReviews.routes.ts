import { Router } from "express";
import * as reviews from "./reviews.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, optionalAuthenticate } from "../../middleware/authenticate.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { requireCaptcha } from "../../middleware/requireCaptcha.js";
import { reviewSubmitLimiter } from "../../middleware/rateLimiters.js";
import { createReviewBodySchema, productReviewParamsSchema } from "./reviews.validators.js";

// Mounted at the same "/products" base path as productsRouter (see
// routes/index.ts) — same "own router, shared mount prefix" pattern as
// Pricing/Inventory, so no Catalog file needs editing for Reviews to exist.
export const productReviewsRouter = Router();

productReviewsRouter.get(
  "/:productId/reviews",
  optionalAuthenticate,
  validate({ params: productReviewParamsSchema }),
  reviews.listForProduct,
);

productReviewsRouter.get(
  "/:productId/reviews/summary",
  optionalAuthenticate,
  validate({ params: productReviewParamsSchema }),
  reviews.getRatingSummary,
);

// The current user's own review for this product, or null — lets the
// storefront decide whether to render "write a review" or "edit yours".
productReviewsRouter.get(
  "/:productId/reviews/mine",
  authenticate,
  validate({ params: productReviewParamsSchema }),
  reviews.getOwnForProduct,
);

// Order matches contact.routes.ts: rate-limit -> auth/transport validation
// -> CAPTCHA last, since it's the most expensive check and should only run
// on an otherwise well-formed, authenticated request. requireVerifiedEmail
// reused with the same justification Returns already established for its
// own customer-initiated POST (RBAC.md's documented intended use).
productReviewsRouter.post(
  "/:productId/reviews",
  reviewSubmitLimiter,
  authenticate,
  requireVerifiedEmail,
  validate({ params: productReviewParamsSchema, body: createReviewBodySchema }),
  requireCaptcha({ action: "review_submit" }),
  reviews.submit,
);
