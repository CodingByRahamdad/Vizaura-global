import type { NextFunction, Request, Response } from "express";
import { ShipmentsService } from "./shipments.service.js";
import { toShipmentView } from "./shipments.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import { toSkipTake, toPaginationMeta } from "../catalog/pagination.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import type { AuthorizationState } from "../rbac/rbac.repository.js";
import type { ListAdminShipmentsQuery, OrderIdParams, ShipmentIdParams, UpdateShipmentInput } from "./shipments.validators.js";

const shipmentsService = new ShipmentsService();

function toAuthorizationState(req: Request): AuthorizationState {
  if (!req.auth) throw authErrors.unauthorized();
  return { roleKeys: req.auth.roleKeys, permissionKeys: [...req.auth.permissions] };
}

function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

export async function getByOrderId(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { orderId } = req.params as unknown as OrderIdParams;
    const shipment = await shipmentsService.getByOrderId(orderId, userId, toAuthorizationState(req));
    res.status(200).json(successResponse(toShipmentView(shipment)));
  } catch (error) {
    next(error);
  }
}

export async function listAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAdminShipmentsQuery;
    const { skip, take } = toSkipTake(query);
    const { shipments, total } = await shipmentsService.listAdmin(query, skip, take);
    res.status(200).json(successResponse(shipments.map(toShipmentView), toPaginationMeta(query, total)));
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ShipmentIdParams;
    const shipment = await shipmentsService.updateStatus(id, req.body as UpdateShipmentInput);
    await recordAudit(req, { action: "UPDATE_SHIPMENT_STATUS", entityType: "Shipment", entityId: id, after: { status: shipment.status } });
    res.status(200).json(successResponse(toShipmentView(shipment)));
  } catch (error) {
    next(error);
  }
}
