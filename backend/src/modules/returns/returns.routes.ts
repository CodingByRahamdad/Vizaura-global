import { Router } from "express";
import * as controller from "./returns.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import {
  createReturnBodySchema,
  listAdminReturnsQuerySchema,
  orderIdParamsSchema,
  rejectReturnBodySchema,
  returnIdParamsSchema,
} from "./returns.validators.js";

// Mounted at "/orders" (routes/index.ts) alongside ordersRouter/shipmentsRouter
// — the same "own router, shared mount prefix" pattern Pricing/Inventory
// established under "/products", and Shipping already reused for
// GET /orders/:orderId/shipment. `requireVerifiedEmail` reused for POST,
// same posture as Checkout's own order-placement gate (RBAC.md's
// documented intended use covers exactly this kind of customer action).
export const returnsOnOrdersRouter = Router();

returnsOnOrdersRouter.post(
  "/:orderId/returns",
  authenticate,
  requireVerifiedEmail,
  validate({ params: orderIdParamsSchema, body: createReturnBodySchema }),
  controller.create,
);

returnsOnOrdersRouter.get(
  "/:orderId/returns",
  authenticate,
  validate({ params: orderIdParamsSchema }),
  controller.listByOrder,
);

// Mounted at "/returns" — a single-return detail lookup, flat like
// Payments' own /payments/:id.
export const returnsRouter = Router();

returnsRouter.get("/:id", authenticate, validate({ params: returnIdParamsSchema }), controller.getById);

// Mounted at "/admin/returns" — same split-router pattern Orders/Payments/
// Shipping established.
export const adminReturnsRouter = Router();

adminReturnsRouter.get(
  "/",
  authenticate,
  requirePermission("returns:read"),
  validate({ query: listAdminReturnsQuerySchema }),
  controller.listAdmin,
);

adminReturnsRouter.patch(
  "/:id/approve",
  authenticate,
  requirePermission("returns:update"),
  validate({ params: returnIdParamsSchema }),
  controller.approve,
);

adminReturnsRouter.patch(
  "/:id/reject",
  authenticate,
  requirePermission("returns:update"),
  validate({ params: returnIdParamsSchema, body: rejectReturnBodySchema }),
  controller.reject,
);

adminReturnsRouter.patch(
  "/:id/receive",
  authenticate,
  requirePermission("returns:update"),
  validate({ params: returnIdParamsSchema }),
  controller.receive,
);

adminReturnsRouter.patch(
  "/:id/refund",
  authenticate,
  requirePermission("returns:update"),
  validate({ params: returnIdParamsSchema }),
  controller.refund,
);
