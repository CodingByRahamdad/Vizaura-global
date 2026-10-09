import type { NextFunction, Request, Response } from "express";
import { ShippingMethodsService } from "./shipping-methods.service.js";
import { toShippingMethodView } from "./shipping-methods.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { toSkipTake, toPaginationMeta } from "../catalog/pagination.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import type {
  CreateShippingMethodInput,
  ListAdminShippingMethodsQuery,
  PublicListShippingMethodsQuery,
  ShippingMethodIdParams,
  UpdateShippingMethodInput,
} from "./shipping-methods.validators.js";

const shippingMethodsService = new ShippingMethodsService();

export async function listPublic(req: Request, res: Response, next: NextFunction) {
  try {
    const { market } = req.query as unknown as PublicListShippingMethodsQuery;
    const methods = await shippingMethodsService.listPublic(market);
    res.status(200).json(successResponse(methods.map(toShippingMethodView)));
  } catch (error) {
    next(error);
  }
}

export async function listAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAdminShippingMethodsQuery;
    const { skip, take } = toSkipTake(query);
    const { methods, total } = await shippingMethodsService.listAdmin(query, skip, take);
    res.status(200).json(successResponse(methods.map(toShippingMethodView), toPaginationMeta(query, total)));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ShippingMethodIdParams;
    const method = await shippingMethodsService.getById(id);
    res.status(200).json(successResponse(toShippingMethodView(method)));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const method = await shippingMethodsService.create(req.body as CreateShippingMethodInput);
    await recordAudit(req, { action: "CREATE_SHIPPING_METHOD", entityType: "ShippingMethod", entityId: method.id, after: method });
    res.status(201).json(successResponse(toShippingMethodView(method)));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ShippingMethodIdParams;
    const method = await shippingMethodsService.update(id, req.body as UpdateShippingMethodInput);
    await recordAudit(req, { action: "UPDATE_SHIPPING_METHOD", entityType: "ShippingMethod", entityId: id, after: method });
    res.status(200).json(successResponse(toShippingMethodView(method)));
  } catch (error) {
    next(error);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ShippingMethodIdParams;
    await shippingMethodsService.archive(id);
    await recordAudit(req, { action: "ARCHIVE_SHIPPING_METHOD", entityType: "ShippingMethod", entityId: id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
