import { Router } from "express";
import * as wishlist from "./wishlist.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { addWishlistItemSchema, wishlistItemParamsSchema } from "./wishlist.validators.js";

// Mounted at "/wishlist" (routes/index.ts) — a flat top-level domain, same
// posture as Cart. Every route requires `authenticate` (never
// `optionalAuthenticate`): a wishlist is always resolved against the
// caller's own userId, ownership-only, no permission path (Customer role
// holds no permissions — see docs/RBAC.md). Unlike Cart, no `?market=` query
// param anywhere — Wishlist is deliberately market-independent (see the
// PRD-grounded decision recorded in docs/CURRENT_TASK.md).
export const wishlistRouter = Router();

wishlistRouter.get("/", authenticate, wishlist.getWishlist);

wishlistRouter.post(
  "/items",
  authenticate,
  validate({ body: addWishlistItemSchema }),
  wishlist.addItem,
);

wishlistRouter.delete(
  "/items/:productId",
  authenticate,
  validate({ params: wishlistItemParamsSchema }),
  wishlist.removeItem,
);
