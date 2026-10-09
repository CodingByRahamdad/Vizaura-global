import type { NextFunction, Request, Response } from "express";
import { InventoryService } from "./inventory.service.js";
import { toAdminInventoryListResponse, toAdminStockResponse, toPublicStockResponse } from "./inventory.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import { toSkipTake, toPaginationMeta } from "../catalog/pagination.js";
import type {
  AdjustStockInput,
  CreateStockInput,
  ListAdminInventoryQuery,
  ReceiveStockInput,
  ReleaseStockInput,
  ReserveStockInput,
  StockListParams,
  StockParams,
} from "./inventory.validators.js";

const inventoryService = new InventoryService();

export async function createStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId } = req.params as unknown as StockListParams;
    const stock = await inventoryService.createStock(productId, variantId, req.body as CreateStockInput);
    res.status(201).json(successResponse(toAdminStockResponse(stock)));
  } catch (error) {
    next(error);
  }
}

export async function receiveStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId, marketCode } = req.params as unknown as StockParams;
    const stock = await inventoryService.receiveStock(
      productId,
      variantId,
      marketCode,
      req.body as ReceiveStockInput,
      req.auth?.userId,
    );
    await recordAudit(req, { action: "RECEIVE_INVENTORY", entityType: "VariantStock", entityId: stock.id, after: stock });
    res.status(200).json(successResponse(toAdminStockResponse(stock)));
  } catch (error) {
    next(error);
  }
}

export async function adjustStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId, marketCode } = req.params as unknown as StockParams;
    const stock = await inventoryService.adjustStock(
      productId,
      variantId,
      marketCode,
      req.body as AdjustStockInput,
      req.auth?.userId,
    );
    await recordAudit(req, { action: "ADJUST_INVENTORY", entityType: "VariantStock", entityId: stock.id, after: stock });
    res.status(200).json(successResponse(toAdminStockResponse(stock)));
  } catch (error) {
    next(error);
  }
}

export async function reserveStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId, marketCode } = req.params as unknown as StockParams;
    const stock = await inventoryService.reserveStock(productId, variantId, marketCode, req.body as ReserveStockInput);
    await recordAudit(req, { action: "RESERVE_INVENTORY", entityType: "VariantStock", entityId: stock.id, after: stock });
    res.status(200).json(successResponse(toAdminStockResponse(stock)));
  } catch (error) {
    next(error);
  }
}

export async function releaseStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId, marketCode } = req.params as unknown as StockParams;
    const { reference } = req.body as ReleaseStockInput;
    const before = await inventoryService.getStock(productId, variantId, marketCode, true);
    await inventoryService.releaseStock(productId, variantId, marketCode, reference);
    await recordAudit(req, { action: "RELEASE_INVENTORY", entityType: "VariantStock", entityId: before.id, before });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId, marketCode } = req.params as unknown as StockParams;
    const canSeeAllStatuses = req.auth?.permissions.has("products:read") ?? false;
    const canSeeAdmin = req.auth?.permissions.has("inventory:read") ?? false;
    const stock = await inventoryService.getStock(productId, variantId, marketCode, canSeeAllStatuses);
    const body = canSeeAdmin ? toAdminStockResponse(stock) : toPublicStockResponse(stock);
    res.status(200).json(successResponse(body));
  } catch (error) {
    next(error);
  }
}

export async function listStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId } = req.params as unknown as StockListParams;
    const canSeeAllStatuses = req.auth?.permissions.has("products:read") ?? false;
    const canSeeAdmin = req.auth?.permissions.has("inventory:read") ?? false;
    const stocks = await inventoryService.listStock(productId, variantId, canSeeAllStatuses);
    const body = canSeeAdmin ? stocks.map(toAdminStockResponse) : stocks.map(toPublicStockResponse);
    res.status(200).json(successResponse(body));
  } catch (error) {
    next(error);
  }
}

/// GET /admin/inventory (Phase 6E) — inventory:read-gated at the route; no
/// public/widening branch, unlike getStock/listStock above.
export async function listAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAdminInventoryQuery;
    const { rows, total } = await inventoryService.listForAdmin(
      { search: query.search, marketCode: query.market },
      toSkipTake(query),
    );
    res.status(200).json(successResponse(rows.map(toAdminInventoryListResponse), toPaginationMeta(query, total)));
  } catch (error) {
    next(error);
  }
}
