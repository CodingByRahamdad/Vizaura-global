import type { NextFunction, Request, Response } from "express";
import { AddressesService } from "./addresses.service.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import type { UpsertAddressInput } from "./addresses.validators.js";

const addressesService = new AddressesService();

/// Addresses are always resolved against the authenticated caller's own
/// userId — never a client-supplied id. Mirrors wishlist.controller.ts's
/// requireUserId exactly.
function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const addresses = await addressesService.getMine(requireUserId(req));
    res.status(200).json(successResponse(addresses));
  } catch (error) {
    next(error);
  }
}

export async function upsertBilling(req: Request, res: Response, next: NextFunction) {
  try {
    const address = await addressesService.upsert(requireUserId(req), "BILLING", req.body as UpsertAddressInput);
    res.status(200).json(successResponse(address));
  } catch (error) {
    next(error);
  }
}

export async function upsertShipping(req: Request, res: Response, next: NextFunction) {
  try {
    const address = await addressesService.upsert(requireUserId(req), "SHIPPING", req.body as UpsertAddressInput);
    res.status(200).json(successResponse(address));
  } catch (error) {
    next(error);
  }
}
