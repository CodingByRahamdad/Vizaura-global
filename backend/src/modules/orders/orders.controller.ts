import type { NextFunction, Request, Response } from "express";
import { OrdersService } from "./orders.service.js";
import {
  resolveOrderThumbnail,
  toAdminOrderDetail,
  toAdminOrderSummary,
  toOrderDetail,
  toOrderSummary,
} from "./orders.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import { toSkipTake, toPaginationMeta } from "../catalog/pagination.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import { notifyAdmins, notifyCustomer } from "../notifications/notifications.helper.js";
import type { OrderStatus } from "../../generated/prisma/client.js";
import type { AuthorizationState } from "../rbac/rbac.repository.js";
import type {
  CreateAdminOrderInput,
  EditAdminOrderInput,
  ListAdminOrdersQuery,
  ListOwnOrdersQuery,
  OrderIdParams,
  UpdateOrderStatusInput,
} from "./orders.validators.js";

const ordersService = new OrdersService();

// Backend-local labels for the customer-facing notification message —
// deliberately not shared with the frontend's own ORDER_STATUS_LABELS
// (frontend-only file); kept as a small, independent copy.
const CUSTOMER_ORDER_STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/// req.auth.permissions is a Set<string> (authenticate.ts); the RBAC layer
/// (authorizeOwnerOrPermission/hasPermission) works against the array-shaped
/// AuthorizationState instead. Built inline from req.auth — no extra DB
/// round trip, since req.auth already carries everything it needs.
function toAuthorizationState(req: Request): AuthorizationState {
  if (!req.auth) throw authErrors.unauthorized();
  return { roleKeys: req.auth.roleKeys, permissionKeys: [...req.auth.permissions] };
}

function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

export async function listOwn(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const query = req.query as unknown as ListOwnOrdersQuery;
    const { skip, take } = toSkipTake(query);
    const { orders, total } = await ordersService.listOwn(userId, query, skip, take);
    res.status(200).json(
      successResponse(
        orders.map((order) => toOrderSummary(order, resolveOrderThumbnail(order.items))),
        toPaginationMeta(query, total),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function getOwnById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as OrderIdParams;
    const order = await ordersService.getOrderById(id, userId, toAuthorizationState(req));
    res.status(200).json(successResponse(toOrderDetail(order)));
  } catch (error) {
    next(error);
  }
}

export async function listAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAdminOrdersQuery;
    const { skip, take } = toSkipTake(query);
    const { orders, total } = await ordersService.listAdmin(query, skip, take);
    res.status(200).json(successResponse(orders.map(toAdminOrderSummary), toPaginationMeta(query, total)));
  } catch (error) {
    next(error);
  }
}

export async function getAdminById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as OrderIdParams;
    const order = await ordersService.getAdminOrderById(id, toAuthorizationState(req));
    res.status(200).json(successResponse(toAdminOrderDetail(order)));
  } catch (error) {
    next(error);
  }
}

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    requireUserId(req); // asserts req.auth exists; actor is recorded via recordAudit below
    const input = req.body as CreateAdminOrderInput;
    const order = await ordersService.createAdminOrder(input);
    await recordAudit(req, {
      action: "CREATE_ADMIN_ORDER",
      entityType: "Order",
      entityId: order.id,
      before: null,
      after: { orderNumber: order.orderNumber, source: "OFFLINE" },
    });
    await notifyAdmins({
      type: "ORDER_PLACED",
      title: "New order created",
      message: `Order ${order.orderNumber} was created.`,
      entityType: "Order",
      entityId: order.id,
      requiredPermission: "orders:read",
    });
    res.status(201).json(successResponse(toAdminOrderDetail(order)));
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as OrderIdParams;
    const { status, reason } = req.body as UpdateOrderStatusInput;
    const { order, previousStatus } = await ordersService.updateStatus(
      id,
      userId,
      toAuthorizationState(req),
      status,
      reason,
    );
    await recordAudit(req, {
      action: "UPDATE_ORDER_STATUS",
      entityType: "Order",
      entityId: id,
      before: { status: previousStatus },
      after: { status: order.status, reason: reason ?? null },
    });
    // Fires only on an actual cancellation (never on other transitions), and
    // can't double-fire — CANCELLED is terminal, so the transition table
    // itself blocks re-entering it on a second request.
    if (order.status === "CANCELLED") {
      await notifyAdmins({
        type: "ORDER_CANCELLED",
        title: "Order cancelled",
        message: `Order ${order.orderNumber} was cancelled.`,
        entityType: "Order",
        entityId: order.id,
        requiredPermission: "orders:read",
      });
    }
    // Skipped for guest orders (order.userId === null). Can't double-fire:
    // this only runs after OrdersRepository.transitionStatus's DB-guarded
    // conditional update has already succeeded, so a retried request fails
    // that guard before ever reaching this line.
    if (order.userId) {
      const label = CUSTOMER_ORDER_STATUS_LABELS[order.status] ?? order.status;
      await notifyCustomer(order.userId, {
        type: "ORDER_STATUS_CHANGED",
        title: `Order ${order.orderNumber} update`,
        message: `Your order ${order.orderNumber} is now ${label}.`,
        entityType: "Order",
        entityId: order.id,
      });
    }
    res.status(200).json(successResponse(toOrderDetail(order)));
  } catch (error) {
    next(error);
  }
}

export async function editAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as OrderIdParams;
    const input = req.body as EditAdminOrderInput;
    const before = await ordersService.getAdminOrderById(id, toAuthorizationState(req));
    const order = await ordersService.editAdmin(id, toAuthorizationState(req), input);
    await recordAudit(req, {
      action: "EDIT_ADMIN_ORDER",
      entityType: "Order",
      entityId: id,
      before: {
        items: before.items.map((item) => ({ id: item.id, quantity: item.quantity, unitAmount: item.unitAmount })),
      },
      after: {
        items: order.items.map((item) => ({ id: item.id, quantity: item.quantity, unitAmount: item.unitAmount })),
        subtotalAmount: order.subtotalAmount,
        totalAmount: order.totalAmount,
      },
    });
    res.status(200).json(successResponse(toAdminOrderDetail(order)));
  } catch (error) {
    next(error);
  }
}

export async function deleteAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as OrderIdParams;
    const before = await ordersService.getAdminOrderById(id, toAuthorizationState(req));
    await ordersService.deleteAdmin(id, toAuthorizationState(req));
    await recordAudit(req, {
      action: "DELETE_ADMIN_ORDER",
      entityType: "Order",
      entityId: id,
      before: { orderNumber: before.orderNumber },
      after: null,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
