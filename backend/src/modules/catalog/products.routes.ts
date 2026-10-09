import { Router } from "express";
import * as products from "./products.controller.js";
import * as variants from "./variants.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, optionalAuthenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { productMediaUpload } from "./mediaUpload.middleware.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  marketParamsSchema,
  productIdParamsSchema,
  replaceCategoriesSchema,
  updateProductSchema,
  upsertProductMarketSchema,
} from "./products.validators.js";
import {
  addOptionValueSchema,
  createMediaSchema,
  createOptionSchema,
  createVariantSchema,
  mediaParamsSchema,
  optionParamsSchema,
  optionValueParamsSchema,
  productIdParamsSchema as nestedProductIdParamsSchema,
  updateMediaSchema,
  updateOptionSchema,
  updateVariantSchema,
  variantParamsSchema,
} from "./variants.validators.js";

export const productsRouter = Router();

// -- Products ---------------------------------------------------------------

productsRouter.post(
  "/",
  authenticate,
  requirePermission("products:create"),
  validate({ body: createProductSchema }),
  products.create,
);

productsRouter.get(
  "/",
  optionalAuthenticate,
  validate({ query: listProductsQuerySchema }),
  products.list,
);

productsRouter.get(
  "/slug/:slug",
  optionalAuthenticate,
  products.getBySlug,
);

productsRouter.get(
  "/:id",
  optionalAuthenticate,
  validate({ params: productIdParamsSchema }),
  products.getById,
);

productsRouter.patch(
  "/:id",
  authenticate,
  requirePermission("products:update"),
  validate({ params: productIdParamsSchema, body: updateProductSchema }),
  products.update,
);

productsRouter.delete(
  "/:id",
  authenticate,
  requirePermission("products:delete"),
  validate({ params: productIdParamsSchema }),
  products.remove,
);

productsRouter.put(
  "/:id/categories",
  authenticate,
  requirePermission("products:update"),
  validate({ params: productIdParamsSchema, body: replaceCategoriesSchema }),
  products.replaceCategories,
);

productsRouter.put(
  "/:id/markets/:marketCode",
  authenticate,
  requirePermission("products:update"),
  validate({ params: marketParamsSchema, body: upsertProductMarketSchema }),
  products.upsertMarket,
);

// -- Variants (nested) --------------------------------------------------

productsRouter.post(
  "/:productId/variants",
  authenticate,
  requirePermission("products:update"),
  validate({ params: nestedProductIdParamsSchema, body: createVariantSchema }),
  variants.createVariant,
);

productsRouter.get(
  "/:productId/variants",
  optionalAuthenticate,
  validate({ params: nestedProductIdParamsSchema }),
  variants.listVariants,
);

productsRouter.patch(
  "/:productId/variants/:variantId",
  authenticate,
  requirePermission("products:update"),
  validate({ params: variantParamsSchema, body: updateVariantSchema }),
  variants.updateVariant,
);

productsRouter.delete(
  "/:productId/variants/:variantId",
  authenticate,
  requirePermission("products:update"),
  validate({ params: variantParamsSchema }),
  variants.removeVariant,
);

// -- Options (nested) -----------------------------------------------------

productsRouter.post(
  "/:productId/options",
  authenticate,
  requirePermission("products:update"),
  validate({ params: nestedProductIdParamsSchema, body: createOptionSchema }),
  variants.createOption,
);

productsRouter.patch(
  "/:productId/options/:optionId",
  authenticate,
  requirePermission("products:update"),
  validate({ params: optionParamsSchema, body: updateOptionSchema }),
  variants.updateOption,
);

productsRouter.delete(
  "/:productId/options/:optionId",
  authenticate,
  requirePermission("products:update"),
  validate({ params: optionParamsSchema }),
  variants.removeOption,
);

productsRouter.post(
  "/:productId/options/:optionId/values",
  authenticate,
  requirePermission("products:update"),
  validate({ params: optionParamsSchema, body: addOptionValueSchema }),
  variants.addOptionValue,
);

productsRouter.delete(
  "/:productId/options/:optionId/values/:valueId",
  authenticate,
  requirePermission("products:update"),
  validate({ params: optionValueParamsSchema }),
  variants.removeOptionValue,
);

// -- Media (nested) -------------------------------------------------------

productsRouter.post(
  "/:productId/media",
  authenticate,
  requirePermission("products:update"),
  validate({ params: nestedProductIdParamsSchema, body: createMediaSchema }),
  variants.createMedia,
);

// Multipart file upload (Phase 6M) — separate from the URL-entry endpoint
// above; both remain supported. authenticate/requirePermission run BEFORE
// multer parses the multipart body, so an unauthenticated/unpermitted
// caller is rejected before anything is written to disk. express.json()
// (app.ts) only intercepts application/json bodies, so it never consumes
// this route's multipart stream — multer sees it untouched.
productsRouter.post(
  "/:productId/media/upload",
  authenticate,
  requirePermission("products:update"),
  validate({ params: nestedProductIdParamsSchema }),
  productMediaUpload,
  variants.uploadMedia,
);

productsRouter.patch(
  "/:productId/media/:mediaId",
  authenticate,
  requirePermission("products:update"),
  validate({ params: mediaParamsSchema, body: updateMediaSchema }),
  variants.updateMedia,
);

productsRouter.delete(
  "/:productId/media/:mediaId",
  authenticate,
  requirePermission("products:update"),
  validate({ params: mediaParamsSchema }),
  variants.removeMedia,
);
