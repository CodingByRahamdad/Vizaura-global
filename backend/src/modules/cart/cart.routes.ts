import { Router } from "express";
import * as cart from "./cart.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import {
  addCartItemSchema,
  cartItemParamsSchema,
  cartQuerySchema,
  updateCartItemSchema,
} from "./cart.validators.js";

// Mounted at "/cart" (routes/index.ts) — a flat top-level domain per
// API_CONTRACTS.md/PRD, unlike Pricing/Inventory which nest under
// "/products" (Cart items reference a variant by id directly, not through
// its parent product).
//
// Every route requires `authenticate` (never `optionalAuthenticate`): a
// cart is always resolved against the caller's own userId, and the
// Customer role holds no permissions at all (RBAC.md) — authorization here
// is ownership-only, matching the project's stated ownership-based model
// for customer-owned resources. No guest-cart route exists — see
// docs/modules/CART.md for why.
export const cartRouter = Router();

cartRouter.get("/", authenticate, validate({ query: cartQuerySchema }), cart.getCart);

cartRouter.post(
  "/items",
  authenticate,
  validate({ query: cartQuerySchema, body: addCartItemSchema }),
  cart.addItem,
);

cartRouter.patch(
  "/items/:itemId",
  authenticate,
  validate({ query: cartQuerySchema, params: cartItemParamsSchema, body: updateCartItemSchema }),
  cart.updateItem,
);

cartRouter.delete(
  "/items/:itemId",
  authenticate,
  validate({ query: cartQuerySchema, params: cartItemParamsSchema }),
  cart.removeItem,
);

cartRouter.delete("/", authenticate, validate({ query: cartQuerySchema }), cart.clearCart);
