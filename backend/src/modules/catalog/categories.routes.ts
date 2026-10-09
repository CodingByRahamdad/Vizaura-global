import { Router } from "express";
import * as controller from "./categories.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, optionalAuthenticate } from "../../middleware/authenticate.js";
import { requireAnyPermission, requirePermission } from "../../middleware/requirePermission.js";
import { categoryImageUpload } from "./mediaUpload.middleware.js";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamsSchema,
  listCategoriesQuerySchema,
} from "./categories.validators.js";

export const categoriesRouter = Router();

categoriesRouter.post(
  "/",
  authenticate,
  requirePermission("categories:create"),
  validate({ body: createCategorySchema }),
  controller.create,
);

categoriesRouter.post(
  "/upload-image",
  authenticate,
  requireAnyPermission(["categories:create", "categories:update"]),
  categoryImageUpload,
  controller.uploadImage,
);

categoriesRouter.get(
  "/",
  optionalAuthenticate,
  validate({ query: listCategoriesQuerySchema }),
  controller.list,
);

categoriesRouter.get(
  "/:id",
  optionalAuthenticate,
  validate({ params: categoryIdParamsSchema }),
  controller.getById,
);

categoriesRouter.patch(
  "/:id",
  authenticate,
  requirePermission("categories:update"),
  validate({ params: categoryIdParamsSchema, body: updateCategorySchema }),
  controller.update,
);

categoriesRouter.delete(
  "/:id",
  authenticate,
  requirePermission("categories:delete"),
  validate({ params: categoryIdParamsSchema }),
  controller.remove,
);
