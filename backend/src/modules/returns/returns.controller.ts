import type { NextFunction, Request, Response } from "express";
import { ReturnsService } from "./returns.service.js";
import { toReturnView } from "./returns.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import { toSkipTake, toPaginationMeta } from "../catalog/pagination.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import type { AuthorizationState } from "../rbac/rbac.repository.js";
import type {
  CreateReturnInput,
  ListAdminReturnsQuery,
  OrderIdParams,
  RejectReturnInput,
  ReturnIdParams,
} from "./returns.validators.js";

const returnsService = new ReturnsService();

function toAuthorizationState(req: Request): AuthorizationState {
  if (!req.auth) throw authErrors.unauthorized();
  return { roleKeys: req.auth.roleKeys, permissionKeys: [...req.auth.permissions] };
}

function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { orderId } = req.params as unknown as OrderIdParams;
    const created = await returnsService.create(orderId, userId, req.body as CreateReturnInput);
    res.status(201).json(successResponse(toReturnView(created)));
  } catch (error) {
    next(error);
  }
}

export async function listByOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { orderId } = req.params as unknown as OrderIdParams;
    const returns = await returnsService.listByOrder(orderId, userId, toAuthorizationState(req));
    res.status(200).json(successResponse(returns.map(toReturnView)));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as ReturnIdParams;
    const ret = await returnsService.getById(id, userId, toAuthorizationState(req));
    res.status(200).json(successResponse(toReturnView(ret)));
  } catch (error) {
    next(error);
  }
}

export async function listAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAdminReturnsQuery;
    const { skip, take } = toSkipTake(query);
    const { returns, total } = await returnsService.listAdmin(query, skip, take);
    res.status(200).json(successResponse(returns.map(toReturnView), toPaginationMeta(query, total)));
  } catch (error) {
    next(error);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as ReturnIdParams;
    const ret = await returnsService.approve(id, userId);
    await recordAudit(req, { action: "APPROVE_RETURN", entityType: "Return", entityId: id, after: { status: ret.status } });
    res.status(200).json(successResponse(toReturnView(ret)));
  } catch (error) {
    next(error);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as ReturnIdParams;
    const { rejectionReason } = req.body as RejectReturnInput;
    const ret = await returnsService.reject(id, userId, rejectionReason);
    await recordAudit(req, { action: "REJECT_RETURN", entityType: "Return", entityId: id, after: { status: ret.status, rejectionReason } });
    res.status(200).json(successResponse(toReturnView(ret)));
  } catch (error) {
    next(error);
  }
}

export async function receive(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as ReturnIdParams;
    const ret = await returnsService.receive(id, userId);
    await recordAudit(req, { action: "RECEIVE_RETURN", entityType: "Return", entityId: id, after: { status: ret.status } });
    res.status(200).json(successResponse(toReturnView(ret)));
  } catch (error) {
    next(error);
  }
}

export async function refund(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as ReturnIdParams;
    const ret = await returnsService.refund(id, userId);
    await recordAudit(req, {
      action: "REFUND_RETURN",
      entityType: "Return",
      entityId: id,
      after: { status: ret.status, refundAmount: ret.refundAmount },
    });
    res.status(200).json(successResponse(toReturnView(ret)));
  } catch (error) {
    next(error);
  }
}
