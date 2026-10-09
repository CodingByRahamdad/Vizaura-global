import { Router } from "express";
import * as markets from "./markets.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { marketIdParamsSchema, updateMarketBodySchema } from "./markets.validators.js";

// Mounted at "/markets" (routes/index.ts) — public, no auth. Active markets
// only (a disabled market must not be offered by the storefront switcher).
export const marketsRouter = Router();

marketsRouter.get("/", markets.listPublic);

// Mounted at "/admin/markets" — same split-router pattern Users/Shipping
// established. See docs/modules/MARKETS.md.
export const adminMarketsRouter = Router();

adminMarketsRouter.get("/", authenticate, requirePermission("markets:read"), markets.listAdmin);

adminMarketsRouter.patch(
  "/:id",
  authenticate,
  requirePermission("markets:update"),
  validate({ params: marketIdParamsSchema, body: updateMarketBodySchema }),
  markets.updateStatus,
);
