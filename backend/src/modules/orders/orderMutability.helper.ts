import { AppError, ordersErrors } from "../../errors/AppError.js";
import { ErrorCodes } from "../../errors/errorCodes.js";
import type { AdminOrderDetailRow, OrdersRepository } from "./orders.repository.js";

/// Shared by admin order edit and admin order hard-delete — an order is
/// mutable (editable or deletable) only while nothing real has happened to
/// it yet: every Payment row is still PENDING, the Shipment is still
/// PENDING (or doesn't exist), and no Return has been opened. Deliberately
/// never checks Order.status — an OFFLINE (admin-created) order can be
/// `status: PENDING` while its Payment is already PAID (the admin can set
/// paymentStatus directly at entry for a cash/bank-transfer order already
/// received), so Order.status cannot be trusted as a proxy for "nothing has
/// happened yet."
export async function assertOrderIsMutable(orderId: string, repo: OrdersRepository): Promise<AdminOrderDetailRow> {
  const order = await repo.findAdminDetailById(orderId);
  if (!order) throw ordersErrors.notFound();

  const allPaymentsPending = order.payments.every((p) => p.status === "PENDING");
  const shipmentPending = order.shipment === null || order.shipment.status === "PENDING";
  const noReturns = order.returns.length === 0;

  if (!allPaymentsPending || !shipmentPending || !noReturns) {
    throw ordersErrors.notEditable();
  }
  return order;
}

/// Same gate, thrown as the delete-specific error instead — see
/// assertOrderIsMutable's own doc comment for the full rationale.
export async function assertOrderIsDeletable(orderId: string, repo: OrdersRepository): Promise<AdminOrderDetailRow> {
  try {
    return await assertOrderIsMutable(orderId, repo);
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCodes.ORDERS_NOT_EDITABLE) {
      throw ordersErrors.notDeletable();
    }
    throw error;
  }
}
