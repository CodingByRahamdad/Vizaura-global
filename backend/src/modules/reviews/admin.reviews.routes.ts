import { Router } from "express";
import * as controller from "./reviews.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import {
  adminCreateReviewBodySchema,
  adminUpdateReviewBodySchema,
  listAdminReviewsQuerySchema,
  reviewIdParamsSchema,
} from "./reviews.validators.js";

// Mounted at "/admin/reviews" (routes/index.ts) — same split-router pattern
// Orders/Payments/Shipping/Returns each established for their own admin
// surface, its own file rather than editing reviews.routes.ts. Permission
// split follows the already-seeded matrix: reviews:read for list/detail,
// reviews:moderate for create/update (publish/unpublish/feature/edit all
// count as moderation), reviews:delete for delete.
export const adminReviewsRouter = Router();

adminReviewsRouter.get(
  "/",
  authenticate,
  requirePermission("reviews:read"),
  validate({ query: listAdminReviewsQuerySchema }),
  controller.adminList,
);

adminReviewsRouter.get(
  "/:id",
  authenticate,
  requirePermission("reviews:read"),
  validate({ params: reviewIdParamsSchema }),
  controller.adminGetById,
);

adminReviewsRouter.post(
  "/",
  authenticate,
  requirePermission("reviews:moderate"),
  validate({ body: adminCreateReviewBodySchema }),
  controller.adminCreate,
);

adminReviewsRouter.patch(
  "/:id",
  authenticate,
  requirePermission("reviews:moderate"),
  validate({ params: reviewIdParamsSchema, body: adminUpdateReviewBodySchema }),
  controller.adminUpdate,
);

adminReviewsRouter.delete(
  "/:id",
  authenticate,
  requirePermission("reviews:delete"),
  validate({ params: reviewIdParamsSchema }),
  controller.adminDelete,
);
