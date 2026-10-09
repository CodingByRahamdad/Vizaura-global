import type { NextFunction, Request, Response } from "express";
import { CartService } from "./cart.service.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import type { AddCartItemInput, CartItemParams, CartQuery, UpdateCartItemInput } from "./cart.validators.js";

const cartService = new CartService();

/// Cart is always resolved against the authenticated caller's own userId —
/// never a client-supplied id — so ownership is structural, not merely
/// checked. `authenticate` (not `optionalAuthenticate`) is required on every
/// route in cart.routes.ts, so req.auth is always present here.
function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

export async function getCart(req: Request, res: Response, next: NextFunction) {
  try {
    const { market } = req.query as unknown as CartQuery;
    const cart = await cartService.getCart(requireUserId(req), market);
    res.status(200).json(successResponse(cart));
  } catch (error) {
    next(error);
  }
}

export async function addItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { market } = req.query as unknown as CartQuery;
    const { variantId, quantity } = req.body as AddCartItemInput;
    const cart = await cartService.addItem(requireUserId(req), market, variantId, quantity);
    res.status(200).json(successResponse(cart));
  } catch (error) {
    next(error);
  }
}

export async function updateItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { market } = req.query as unknown as CartQuery;
    const { itemId } = req.params as unknown as CartItemParams;
    const { quantity } = req.body as UpdateCartItemInput;
    const cart = await cartService.updateItemQuantity(requireUserId(req), market, itemId, quantity);
    res.status(200).json(successResponse(cart));
  } catch (error) {
    next(error);
  }
}

export async function removeItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { market } = req.query as unknown as CartQuery;
    const { itemId } = req.params as unknown as CartItemParams;
    await cartService.removeItem(requireUserId(req), market, itemId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function clearCart(req: Request, res: Response, next: NextFunction) {
  try {
    const { market } = req.query as unknown as CartQuery;
    await cartService.clearCart(requireUserId(req), market);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
