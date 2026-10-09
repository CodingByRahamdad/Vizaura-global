import type { NextFunction, Request, Response } from "express";
import { MarketsService } from "./markets.service.js";
import { toAdminMarket, toPublicMarket } from "./markets.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import type { MarketIdParams, UpdateMarketInput } from "./markets.validators.js";

const marketsService = new MarketsService();

export async function listPublic(_req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await marketsService.listActive();
    res.status(200).json(successResponse(rows.map(toPublicMarket)));
  } catch (error) {
    next(error);
  }
}

export async function listAdmin(_req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await marketsService.listAll();
    res.status(200).json(successResponse(rows.map(toAdminMarket)));
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as MarketIdParams;
    const { isActive } = req.body as UpdateMarketInput;
    const { market, previousIsActive } = await marketsService.updateIsActive(id, isActive);
    await recordAudit(req, {
      action: "UPDATE_MARKET_STATUS",
      entityType: "Market",
      entityId: id,
      before: { isActive: previousIsActive },
      after: { isActive: market.isActive },
    });
    res.status(200).json(successResponse(toAdminMarket(market)));
  } catch (error) {
    next(error);
  }
}
