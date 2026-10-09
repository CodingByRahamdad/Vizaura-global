import { Router } from "express";
import * as controller from "./promotions.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireAnyPermission, requirePermission } from "../../middleware/requirePermission.js";
import { promotionImageUpload } from "../catalog/mediaUpload.middleware.js";
import {
  broadcastPromotionSchema,
  createPromotionSchema,
  listAdminPromotionsQuerySchema,
  promotionIdParamsSchema,
  updatePromotionSchema,
} from "./promotions.validators.js";

// Mounted at "/admin/promotions" (routes/index.ts) — same split-router
// pattern Categories/Reviews/Orders each established for their own admin
// surface. Permission split follows the already-seeded matrix: promotions:read
// for list/detail, promotions:create for create (+ shared with update for
// image upload), promotions:update for update, promotions:delete for delete.
export const adminPromotionsRouter = Router();

adminPromotionsRouter.get(
  "/",
  authenticate,
  requirePermission("promotions:read"),
  validate({ query: listAdminPromotionsQuerySchema }),
  controller.list,
);

adminPromotionsRouter.get(
  "/:id",
  authenticate,
  requirePermission("promotions:read"),
  validate({ params: promotionIdParamsSchema }),
  controller.getById,
);

adminPromotionsRouter.post(
  "/",
  authenticate,
  requirePermission("promotions:create"),
  validate({ body: createPromotionSchema }),
  controller.create,
);

adminPromotionsRouter.post(
  "/upload-image",
  authenticate,
  requireAnyPermission(["promotions:create", "promotions:update"]),
  promotionImageUpload,
  controller.uploadImage,
);

adminPromotionsRouter.patch(
  "/:id",
  authenticate,
  requirePermission("promotions:update"),
  validate({ params: promotionIdParamsSchema, body: updatePromotionSchema }),
  controller.update,
);

adminPromotionsRouter.delete(
  "/:id",
  authenticate,
  requirePermission("promotions:delete"),
  validate({ params: promotionIdParamsSchema }),
  controller.remove,
);

// Minimal admin-triggered customer notification broadcast — no automatic
// trigger exists tied to promotion create/update, so this is a deliberate,
// separate manual action. Reuses the existing promotions:update permission
// (an admin who can edit promotions is the natural gate) — no new
// permission string added to the seed matrix.
adminPromotionsRouter.post(
  "/broadcast",
  authenticate,
  requirePermission("promotions:update"),
  validate({ body: broadcastPromotionSchema }),
  controller.broadcast,
);
