import { Router } from "express";
import * as inventory from "./inventory.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, optionalAuthenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import {
  adjustStockSchema,
  createStockSchema,
  listAdminInventoryQuerySchema,
  receiveStockSchema,
  releaseStockSchema,
  reserveStockSchema,
  stockListParamsSchema,
  stockParamsSchema,
} from "./inventory.validators.js";

// Mounted at the same "/products" base path as productsRouter/pricingRouter
// (see routes/index.ts) — own router/file so no Catalog/Pricing file needs
// editing for Inventory to exist (see docs/modules/INVENTORY.md).
export const inventoryRouter = Router();

inventoryRouter.post(
  "/:productId/variants/:variantId/stock",
  authenticate,
  requirePermission("inventory:update"),
  validate({ params: stockListParamsSchema, body: createStockSchema }),
  inventory.createStock,
);

inventoryRouter.get(
  "/:productId/variants/:variantId/stock",
  optionalAuthenticate,
  validate({ params: stockListParamsSchema }),
  inventory.listStock,
);

inventoryRouter.get(
  "/:productId/variants/:variantId/stock/:marketCode",
  optionalAuthenticate,
  validate({ params: stockParamsSchema }),
  inventory.getStock,
);

inventoryRouter.post(
  "/:productId/variants/:variantId/stock/:marketCode/receive",
  authenticate,
  requirePermission("inventory:update"),
  validate({ params: stockParamsSchema, body: receiveStockSchema }),
  inventory.receiveStock,
);

inventoryRouter.post(
  "/:productId/variants/:variantId/stock/:marketCode/adjust",
  authenticate,
  requirePermission("inventory:update"),
  validate({ params: stockParamsSchema, body: adjustStockSchema }),
  inventory.adjustStock,
);

inventoryRouter.post(
  "/:productId/variants/:variantId/stock/:marketCode/reserve",
  authenticate,
  requirePermission("inventory:update"),
  validate({ params: stockParamsSchema, body: reserveStockSchema }),
  inventory.reserveStock,
);

inventoryRouter.post(
  "/:productId/variants/:variantId/stock/:marketCode/release",
  authenticate,
  requirePermission("inventory:update"),
  validate({ params: stockParamsSchema, body: releaseStockSchema }),
  inventory.releaseStock,
);

// Mounted at "/admin/inventory" (routes/index.ts) — Phase 6E, the first
// Inventory endpoint that lists across the whole catalog rather than one
// product+variant, following the same dedicated "/admin" prefix pattern
// orders.routes.ts established (adminOrdersRouter) rather than the
// same-router-permission-gated pattern the rest of this file uses, since
// there is no public/storefront equivalent of a cross-catalog stock list.
export const adminInventoryRouter = Router();

adminInventoryRouter.get(
  "/",
  authenticate,
  requirePermission("inventory:read"),
  validate({ query: listAdminInventoryQuerySchema }),
  inventory.listAdmin,
);
