import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AdminOrderPayment } from "@/lib/types/admin-orders";

/**
 * Admin payment staff actions. All COD-only mark-* actions require the
 * payment to be PENDING (mark-paid/mark-failed) or PAID/PARTIALLY_REFUNDED
 * (mark-refunded); the backend is the sole state-machine authority and
 * rejects everything else with 422 PAYMENTS_INVALID_STATUS_TRANSITION /
 * PAYMENTS_STAFF_ACTION_UNSUPPORTED. Races come back as 409
 * PAYMENTS_STATUS_CONFLICT.
 */

export interface MarkRefundedInput {
  amount?: number;
  reference?: string;
}

export interface RefundInput {
  amount?: number;
}

/** PATCH /admin/payments/:id/mark-paid (payments:update) — COD only, PENDING → PAID. */
export async function markPaymentPaid(id: string): Promise<AdminOrderPayment> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderPayment>(ENDPOINTS.admin.paymentMarkPaid(id), { method: "PATCH", cache: "no-store" })
  );
}

/** PATCH /admin/payments/:id/mark-failed (payments:update) — COD only, PENDING → FAILED. */
export async function markPaymentFailed(id: string, reason: string): Promise<AdminOrderPayment> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderPayment>(ENDPOINTS.admin.paymentMarkFailed(id), {
      method: "PATCH",
      body: JSON.stringify({ reason }),
      cache: "no-store",
    })
  );
}

/**
 * PATCH /admin/payments/:id/mark-refunded (payments:refund) — COD staff
 * attestation (no gateway call). Omitted amount refunds the full remaining
 * captured amount, computed server-side.
 */
export async function markPaymentRefunded(id: string, input: MarkRefundedInput = {}): Promise<AdminOrderPayment> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderPayment>(ENDPOINTS.admin.paymentMarkRefunded(id), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

/**
 * POST /payments/:id/refund (payments:refund) — calls the payment provider
 * (e.g. MOCK). Not valid for COD, which has no gateway; use
 * markPaymentRefunded for COD instead.
 */
export async function refundPayment(id: string, input: RefundInput = {}): Promise<AdminOrderPayment> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderPayment>(ENDPOINTS.payments.refund(id), {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}
