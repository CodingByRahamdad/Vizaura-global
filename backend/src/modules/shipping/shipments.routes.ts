import { Router } from "express";
import * as controller from "./shipments.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { listAdminShipmentsQuerySchema, orderIdParamsSchema, shipmentIdParamsSchema, updateShipmentBodySchema } from "./shipments.validators.js";

// Mounted at "/orders" (routes/index.ts) alongside ordersRouter — the same
// "own router/file, same mount prefix" pattern Inventory/Pricing already
// established under "/products". GET /:orderId/shipment is the PRD's own
// literal nested route (§2C.14). Ownership-or-shipping:read, resolved
// through the parent Order — Customer role holds no permissions.
export const shipmentsRouter = Router();

shipmentsRouter.get(
  "/:orderId/shipment",
  authenticate,
  validate({ params: orderIdParamsSchema }),
  controller.getByOrderId,
);

// Mounted at "/admin/shipments" — same split-router pattern Orders/Payments
// established.
export const adminShipmentsRouter = Router();

adminShipmentsRouter.get(
  "/",
  authenticate,
  requirePermission("shipping:read"),
  validate({ query: listAdminShipmentsQuerySchema }),
  controller.listAdmin,
);

adminShipmentsRouter.patch(
  "/:id",
  authenticate,
  requirePermission("shipping:update"),
  validate({ params: shipmentIdParamsSchema, body: updateShipmentBodySchema }),
  controller.updateStatus,
);
