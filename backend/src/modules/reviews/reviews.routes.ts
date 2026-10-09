import { Router } from "express";
import * as reviews from "./reviews.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, optionalAuthenticate } from "../../middleware/authenticate.js";
import {
  featuredReviewsQuerySchema,
  listPublicReviewsQuerySchema,
  reviewIdParamsSchema,
  updateReviewBodySchema,
} from "./reviews.validators.js";

// Top-level "/reviews" prefix (see routes/index.ts) — distinct from
// productReviewsRouter's "/products" mount, since a "featured" review isn't
// scoped to one product (it backs the homepage testimonial band), and
// editing/deleting one's own review is addressed by its own id, not a
// product-scoped path.
export const reviewsRouter = Router();

// Public, cross-product, published-only listing — backs the storefront's
// sitewide "All Reviews" page. No auth required, same posture as /featured.
reviewsRouter.get(
  "/",
  validate({ query: listPublicReviewsQuerySchema }),
  reviews.listAll,
);

reviewsRouter.get(
  "/featured",
  optionalAuthenticate,
  validate({ query: featuredReviewsQuerySchema }),
  reviews.listFeatured,
);

// Ownership-based (no permission check) — same posture as wishlist.routes.ts.
// ReviewsService.updateOwn/deleteOwn resolve ownership themselves and 404
// (never 403) on a mismatch.
reviewsRouter.patch(
  "/:id",
  authenticate,
  validate({ params: reviewIdParamsSchema, body: updateReviewBodySchema }),
  reviews.updateOwn,
);

reviewsRouter.delete(
  "/:id",
  authenticate,
  validate({ params: reviewIdParamsSchema }),
  reviews.deleteOwn,
);
