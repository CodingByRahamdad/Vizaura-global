import { Router } from "express";
import * as pricing from "./pricing.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, optionalAuthenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { priceListParamsSchema, priceParamsSchema, upsertPriceSchema } from "./pricing.validators.js";

// Mounted at the same "/products" base path as productsRouter (see
// routes/index.ts) — Express allows multiple routers on one prefix. Kept as
// its own router/file rather than appended to catalog/products.routes.ts so
// no Catalog file needs editing for Pricing to exist (see
// docs/modules/PRICING.md and DEVELOPMENT_RULES.md #1/#21).
export const pricingRouter = Router();

pricingRouter.put(
  "/:productId/variants/:variantId/prices/:marketCode",
  authenticate,
  requirePermission("pricing:update"),
  validate({ params: priceParamsSchema, body: upsertPriceSchema }),
  pricing.setPrice,
);

pricingRouter.delete(
  "/:productId/variants/:variantId/prices/:marketCode",
  authenticate,
  requirePermission("pricing:update"),
  validate({ params: priceParamsSchema }),
  pricing.removePrice,
);

pricingRouter.get(
  "/:productId/variants/:variantId/prices",
  optionalAuthenticate,
  validate({ params: priceListParamsSchema }),
  pricing.listPrices,
);

pricingRouter.get(
  "/:productId/variants/:variantId/prices/:marketCode",
  optionalAuthenticate,
  validate({ params: priceParamsSchema }),
  pricing.getPrice,
);
