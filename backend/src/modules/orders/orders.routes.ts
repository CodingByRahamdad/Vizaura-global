import { Router } from "express";
import * as orders from "./orders.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission, requireAnyPermission } from "../../middleware/requirePermission.js";
import {
  createAdminOrderBodySchema,
  editAdminOrderBodySchema,
  listAdminOrdersQuerySchema,
  listOwnOrdersQuerySchema,
  orderIdParamsSchema,
  updateOrderStatusBodySchema,
} from "./orders.validators.js";

// Mounted at "/orders" (routes/index.ts) — customer-facing, ownership-only
// (Customer role holds no permissions — RBAC.md). No requireVerifiedEmail:
// reading order history doesn't need a confirmed email, unlike placing one.
export const ordersRouter = Router();

ordersRouter.get("/", authenticate, validate({ query: listOwnOrdersQuerySchema }), orders.listOwn);
ordersRouter.get("/:id", authenticate, validate({ params: orderIdParamsSchema }), orders.getOwnById);

// Mounted at "/admin/orders" (routes/index.ts) — the first module in this
// codebase to use a dedicated "/admin" URL prefix, matching the PRD's
// literal endpoint spec (docs/SHILAJIT _PRD.md §2C.11) rather than the
// same-router-permission-gated pattern Pricing/Inventory established.
export const adminOrdersRouter = Router();

adminOrdersRouter.get(
  "/",
  authenticate,
  requirePermission("orders:read"),
  validate({ query: listAdminOrdersQuerySchema }),
  orders.listAdmin,
);

adminOrdersRouter.post(
  "/",
  authenticate,
  requirePermission("orders:create"),
  validate({ body: createAdminOrderBodySchema }),
  orders.createAdmin,
);

adminOrdersRouter.get(
  "/:id",
  authenticate,
  requirePermission("orders:read"),
  validate({ params: orderIdParamsSchema }),
  orders.getAdminById,
);

adminOrdersRouter.patch(
  "/:id/status",
  authenticate,
  requireAnyPermission(["orders:update", "orders:cancel"]),
  validate({ params: orderIdParamsSchema, body: updateOrderStatusBodySchema }),
  orders.updateStatus,
);

// Address/line-item edit — only reachable while the order is still fully
// mutable (orderMutability.helper.ts). Reuses orders:update, the same
// action class as the status PATCH above.
adminOrdersRouter.patch(
  "/:id",
  authenticate,
  requirePermission("orders:update"),
  validate({ params: orderIdParamsSchema, body: editAdminOrderBodySchema }),
  orders.editAdmin,
);

// Hard delete — only reachable while the order is still fully mutable
// (same gate as the edit route above).
adminOrdersRouter.delete(
  "/:id",
  authenticate,
  requirePermission("orders:delete"),
  validate({ params: orderIdParamsSchema }),
  orders.deleteAdmin,
);
