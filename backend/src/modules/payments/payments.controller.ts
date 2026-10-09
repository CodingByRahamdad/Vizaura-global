import type { NextFunction, Request, Response } from "express";
import { PaymentsService } from "./payments.service.js";
import { toPaymentDetailView, toPaymentSummaryView } from "./payments.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import { toSkipTake, toPaginationMeta } from "../catalog/pagination.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import type { AuthorizationState } from "../rbac/rbac.repository.js";
import type {
  ListAdminPaymentsQuery,
  MarkFailedInput,
  MarkRefundedInput,
  PaymentIdParams,
  RefundInput,
} from "./payments.validators.js";

const paymentsService = new PaymentsService();

/// Same pattern as orders.controller.ts — req.auth.permissions is a
/// Set<string>, the RBAC layer needs the array-shaped AuthorizationState.
function toAuthorizationState(req: Request): AuthorizationState {
  if (!req.auth) throw authErrors.unauthorized();
  return { roleKeys: req.auth.roleKeys, permissionKeys: [...req.auth.permissions] };
}

function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as PaymentIdParams;
    const payment = await paymentsService.getById(id, userId, toAuthorizationState(req));
    res.status(200).json(successResponse(toPaymentDetailView(payment)));
  } catch (error) {
    next(error);
  }
}

export async function refund(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as PaymentIdParams;
    const { amount } = req.body as RefundInput;
    const payment = await paymentsService.refund(id, amount);
    await recordAudit(req, { action: "REFUND_PAYMENT", entityType: "Payment", entityId: id, after: payment });
    res.status(200).json(successResponse(toPaymentDetailView(payment)));
  } catch (error) {
    next(error);
  }
}

export async function listAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAdminPaymentsQuery;
    const { skip, take } = toSkipTake(query);
    const { payments, total } = await paymentsService.listAdmin(query, skip, take);
    res.status(200).json(successResponse(payments.map(toPaymentSummaryView), toPaginationMeta(query, total)));
  } catch (error) {
    next(error);
  }
}

export async function markPaid(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as PaymentIdParams;
    const payment = await paymentsService.markPaid(id, userId);
    await recordAudit(req, { action: "MARK_PAYMENT_PAID", entityType: "Payment", entityId: id, after: payment });
    res.status(200).json(successResponse(toPaymentDetailView(payment)));
  } catch (error) {
    next(error);
  }
}

export async function markFailed(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as PaymentIdParams;
    const { reason } = req.body as MarkFailedInput;
    const payment = await paymentsService.markFailed(id, userId, reason);
    await recordAudit(req, { action: "MARK_PAYMENT_FAILED", entityType: "Payment", entityId: id, after: { status: payment.status, reason } });
    res.status(200).json(successResponse(toPaymentDetailView(payment)));
  } catch (error) {
    next(error);
  }
}

export async function markRefunded(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as PaymentIdParams;
    const { amount, reference } = req.body as MarkRefundedInput;
    const payment = await paymentsService.markRefunded(id, userId, amount, reference);
    await recordAudit(req, { action: "MARK_PAYMENT_REFUNDED", entityType: "Payment", entityId: id, after: payment });
    res.status(200).json(successResponse(toPaymentDetailView(payment)));
  } catch (error) {
    next(error);
  }
}
