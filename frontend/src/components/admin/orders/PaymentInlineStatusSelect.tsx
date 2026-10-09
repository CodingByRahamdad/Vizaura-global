"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { markPaymentFailed, markPaymentPaid, markPaymentRefunded } from "@/lib/api/admin/payments";
import type { PaymentStatus } from "@/lib/types/checkout";
import { PAYMENT_STATUS_LABELS } from "@/lib/types/orders";
import { PAYMENTS_ERROR_MESSAGES } from "@/lib/types/admin-orders";
import { OrderPaymentBadge } from "./OrderBadges";

type PaymentActionKind = "mark-paid" | "mark-failed" | "mark-refunded";

interface PaymentAction {
  kind: PaymentActionKind;
  targetStatus: PaymentStatus;
}

interface PaymentInlineStatusSelectProps {
  paymentId: string | null;
  provider: string | null;
  status: PaymentStatus;
  canUpdate: boolean;
  canRefund: boolean;
}

/**
 * List-page counterpart to PaymentActions.tsx — same staff-attested
 * COD/MANUAL-only action set (a gateway-backed payment like MOCK shows a
 * read-only badge here; its refund still goes through the order detail
 * page), reusing the exact same three mark-paid/mark-failed/mark-refunded
 * endpoints. mark-failed requires a non-empty reason server-side, so that
 * one action still needs a small inline prompt rather than applying
 * instantly like the others.
 */
export function PaymentInlineStatusSelect({
  paymentId,
  provider,
  status,
  canUpdate,
  canRefund,
}: PaymentInlineStatusSelectProps) {
  const router = useRouter();
  const [pendingFailReason, setPendingFailReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStaffAttested = provider === "COD" || provider === "MANUAL";
  const isRefundable = status === "PAID" || status === "PARTIALLY_REFUNDED";

  const actions: PaymentAction[] = [];
  if (canUpdate && isStaffAttested && status === "PENDING") {
    actions.push({ kind: "mark-paid", targetStatus: "PAID" });
    actions.push({ kind: "mark-failed", targetStatus: "FAILED" });
  }
  if (canRefund && isStaffAttested && isRefundable) {
    actions.push({ kind: "mark-refunded", targetStatus: "REFUNDED" });
  }

  if (!paymentId || actions.length === 0) {
    return <OrderPaymentBadge status={status} />;
  }

  async function apply(action: PaymentAction, reason?: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      if (action.kind === "mark-paid") await markPaymentPaid(paymentId!);
      else if (action.kind === "mark-failed") await markPaymentFailed(paymentId!, reason ?? "");
      else await markPaymentRefunded(paymentId!);
      setPendingFailReason(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(PAYMENTS_ERROR_MESSAGES[err.code ?? ""] ?? err.message);
        if (err.status === 409 || err.status === 422) router.refresh();
      } else {
        setError("Couldn't update the payment.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pendingFailReason !== null) {
    return (
      <div className="flex flex-col gap-1">
        <input
          type="text"
          autoFocus
          placeholder="Reason for failure"
          maxLength={255}
          value={pendingFailReason}
          onChange={(event) => setPendingFailReason(event.target.value)}
          className="w-36 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        />
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            className="font-medium text-error underline disabled:opacity-60"
            disabled={isSubmitting || pendingFailReason.trim().length === 0}
            onClick={() => void apply({ kind: "mark-failed", targetStatus: "FAILED" }, pendingFailReason.trim())}
          >
            Confirm
          </button>
          <button
            type="button"
            className="text-text-secondary underline disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => setPendingFailReason(null)}
          >
            Back
          </button>
        </div>
        {error ? <span className="text-xs text-error">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="Payment status"
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text disabled:opacity-60"
        value={status}
        disabled={isSubmitting}
        onChange={(event) => {
          const action = actions.find((a) => a.targetStatus === event.target.value);
          if (!action) return;
          if (action.kind === "mark-failed") {
            setPendingFailReason("");
            return;
          }
          void apply(action);
        }}
      >
        <option value={status}>{PAYMENT_STATUS_LABELS[status]}</option>
        {actions.map((action) => (
          <option key={action.kind} value={action.targetStatus}>
            {PAYMENT_STATUS_LABELS[action.targetStatus]}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </div>
  );
}
