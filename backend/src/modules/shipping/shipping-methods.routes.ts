import { Router } from "express";
import * as controller from "./shipping-methods.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import {
  createShippingMethodSchema,
  listAdminShippingMethodsQuerySchema,
  publicListShippingMethodsQuerySchema,
  shippingMethodIdParamsSchema,
  updateShippingMethodSchema,
} from "./shipping-methods.validators.js";

// Mounted at "/shipping/methods" (routes/index.ts) — public, customer-facing:
// active methods for one market, the checkout-selection list. No auth at
// all (matches the PRD's literal "Customer: GET /api/v1/shipping/methods"
// with no auth requirement).
export const shippingMethodsRouter = Router();

shippingMethodsRouter.get(
  "/",
  validate({ query: publicListShippingMethodsQuerySchema }),
  controller.listPublic,
);

// Mounted at "/admin/shipping/methods" — same split-router pattern
// Orders/Payments established (docs/modules/ORDERS.md).
export const adminShippingMethodsRouter = Router();

adminShippingMethodsRouter.get(
  "/",
  authenticate,
  requirePermission("shipping:read"),
  validate({ query: listAdminShippingMethodsQuerySchema }),
  controller.listAdmin,
);

adminShippingMethodsRouter.post(
  "/",
  authenticate,
  requirePermission("shipping:update"),
  validate({ body: createShippingMethodSchema }),
  controller.create,
);

adminShippingMethodsRouter.get(
  "/:id",
  authenticate,
  requirePermission("shipping:read"),
  validate({ params: shippingMethodIdParamsSchema }),
  controller.getById,
);

adminShippingMethodsRouter.patch(
  "/:id",
  authenticate,
  requirePermission("shipping:update"),
  validate({ params: shippingMethodIdParamsSchema, body: updateShippingMethodSchema }),
  controller.update,
);

// Archives (isActive=false), never a hard delete — see the schema's own
// doc comment and docs/modules/SHIPPING.md.
adminShippingMethodsRouter.delete(
  "/:id",
  authenticate,
  requirePermission("shipping:update"),
  validate({ params: shippingMethodIdParamsSchema }),
  controller.archive,
);
