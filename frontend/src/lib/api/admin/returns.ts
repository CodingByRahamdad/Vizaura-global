import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AdminOrderReturn } from "@/lib/types/admin-orders";

/**
 * Admin return staff actions, all gated by returns:update. The backend owns
 * the state machine (REQUESTED → APPROVED/REJECTED, APPROVED → RECEIVED,
 * RECEIVED → REFUNDED); invalid moves come back as 422
 * RETURNS_INVALID_STATUS_TRANSITION, races as 409 RETURNS_STATUS_CONFLICT.
 * receive() restocks inventory and refund() calls Payments server-side —
 * there is nothing for the frontend to orchestrate beyond the single call.
 */

/** PATCH /admin/returns/:id/approve — REQUESTED → APPROVED. */
export async function approveReturn(id: string): Promise<AdminOrderReturn> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderReturn>(ENDPOINTS.admin.returnApprove(id), { method: "PATCH", cache: "no-store" })
  );
}

/** PATCH /admin/returns/:id/reject — REQUESTED → REJECTED. rejectionReason is required. */
export async function rejectReturn(id: string, rejectionReason: string): Promise<AdminOrderReturn> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderReturn>(ENDPOINTS.admin.returnReject(id), {
      method: "PATCH",
      body: JSON.stringify({ rejectionReason }),
      cache: "no-store",
    })
  );
}

/** PATCH /admin/returns/:id/receive — APPROVED → RECEIVED. Restocks inventory server-side. */
export async function receiveReturn(id: string): Promise<AdminOrderReturn> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderReturn>(ENDPOINTS.admin.returnReceive(id), { method: "PATCH", cache: "no-store" })
  );
}

/** PATCH /admin/returns/:id/refund — RECEIVED → REFUNDED. Delegates to Payments server-side. */
export async function refundReturn(id: string): Promise<AdminOrderReturn> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderReturn>(ENDPOINTS.admin.returnRefund(id), { method: "PATCH", cache: "no-store" })
  );
}
