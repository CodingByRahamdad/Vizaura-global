import type { NextFunction, Request, Response } from "express";
import { WishlistService } from "./wishlist.service.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import type { AddWishlistItemInput, WishlistItemParams } from "./wishlist.validators.js";

const wishlistService = new WishlistService();

/// Wishlist is always resolved against the authenticated caller's own
/// userId — never a client-supplied id — so ownership is structural, not
/// merely checked. `authenticate` is required on every route in
/// wishlist.routes.ts, so req.auth is always present here. Mirrors
/// cart.controller.ts's requireUserId exactly.
function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

export async function getWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const wishlist = await wishlistService.getWishlist(requireUserId(req));
    res.status(200).json(successResponse(wishlist));
  } catch (error) {
    next(error);
  }
}

export async function addItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.body as AddWishlistItemInput;
    const wishlist = await wishlistService.addItem(requireUserId(req), productId);
    res.status(200).json(successResponse(wishlist));
  } catch (error) {
    next(error);
  }
}

export async function removeItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params as unknown as WishlistItemParams;
    await wishlistService.removeItem(requireUserId(req), productId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
