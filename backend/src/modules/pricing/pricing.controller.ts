import type { NextFunction, Request, Response } from "express";
import { PricingService } from "./pricing.service.js";
import { toAdminPriceResponse, toPublicPriceResponse } from "./pricing.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import type { PriceListParams, PriceParams, UpsertPriceInput } from "./pricing.validators.js";

const pricingService = new PricingService();

// The PRD's own literal worked audit example (§49): UPDATE_PRODUCT_PRICE,
// before/after amount. `before` is best-effort — a first-time price set has
// none, and a not-found lookup is expected, not an error worth surfacing.
async function tryGetPriceForAudit(productId: string, variantId: string, marketCode: string) {
  try {
    return await pricingService.getPrice(productId, variantId, marketCode, true, true);
  } catch {
    return undefined;
  }
}

export async function setPrice(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId, marketCode } = req.params as unknown as PriceParams;
    const before = await tryGetPriceForAudit(productId, variantId, marketCode);
    const price = await pricingService.setPrice(productId, variantId, marketCode, req.body as UpsertPriceInput);
    await recordAudit(req, { action: "UPDATE_PRODUCT_PRICE", entityType: "MarketPrice", entityId: price.id, before, after: price });
    res.status(200).json(successResponse(toAdminPriceResponse(price)));
  } catch (error) {
    next(error);
  }
}

export async function removePrice(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId, marketCode } = req.params as unknown as PriceParams;
    const before = await tryGetPriceForAudit(productId, variantId, marketCode);
    await pricingService.removePrice(productId, variantId, marketCode);
    if (before) {
      await recordAudit(req, { action: "DELETE_PRODUCT_PRICE", entityType: "MarketPrice", entityId: before.id, before });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getPrice(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId, marketCode } = req.params as unknown as PriceParams;
    const canSeeAllStatuses = req.auth?.permissions.has("products:read") ?? false;
    const canSeeAdmin = req.auth?.permissions.has("pricing:read") ?? false;
    const price = await pricingService.getPrice(productId, variantId, marketCode, canSeeAllStatuses, canSeeAdmin);
    const body = canSeeAdmin ? toAdminPriceResponse(price) : toPublicPriceResponse(price);
    res.status(200).json(successResponse(body));
  } catch (error) {
    next(error);
  }
}

export async function listPrices(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId } = req.params as unknown as PriceListParams;
    const canSeeAllStatuses = req.auth?.permissions.has("products:read") ?? false;
    const canSeeAdmin = req.auth?.permissions.has("pricing:read") ?? false;
    const prices = await pricingService.listPrices(productId, variantId, canSeeAllStatuses, canSeeAdmin);
    const body = canSeeAdmin ? prices.map(toAdminPriceResponse) : prices.map(toPublicPriceResponse);
    res.status(200).json(successResponse(body));
  } catch (error) {
    next(error);
  }
}
