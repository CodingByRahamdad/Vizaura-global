import type { ReturnWithItems } from "./returns.repository.js";

export interface ReturnItemView {
  id: string;
  orderItemId: string;
  quantity: number;
}

export interface ReturnView {
  id: string;
  orderId: string;
  status: string;
  reason: string | null;
  rejectionReason: string | null;
  refundAmount: number | null;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  items: ReturnItemView[];
  createdAt: string;
  updatedAt: string;
}

export function toReturnView(ret: ReturnWithItems): ReturnView {
  return {
    id: ret.id,
    orderId: ret.orderId,
    status: ret.status,
    reason: ret.reason,
    rejectionReason: ret.rejectionReason,
    refundAmount: ret.refundAmount,
    requestedByUserId: ret.requestedByUserId,
    reviewedByUserId: ret.reviewedByUserId,
    reviewedAt: ret.reviewedAt ? ret.reviewedAt.toISOString() : null,
    receivedAt: ret.receivedAt ? ret.receivedAt.toISOString() : null,
    refundedAt: ret.refundedAt ? ret.refundedAt.toISOString() : null,
    items: ret.items.map((item) => ({ id: item.id, orderItemId: item.orderItemId, quantity: item.quantity })),
    createdAt: ret.createdAt.toISOString(),
    updatedAt: ret.updatedAt.toISOString(),
  };
}
