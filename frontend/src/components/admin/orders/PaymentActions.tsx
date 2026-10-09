"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { markPaymentFailed, markPaymentPaid, markPaymentRefunded, refundPayment } from "@/lib/api/admin/payments";
import type { AdminOrderPayment } from "@/lib/types/admin-orders";
import { PAYMENTS_ERROR_MESSAGES } from "@/lib/types/admin-orders";

type PaymentActionKind = "mark-paid" | "mark-failed" | "mark-refunded" | "refund";

interface PaymentActionsProps {
  payment: AdminOrderPayment;
  canUpdate: boolean;
  canRefund: boolean;
}

/**
 * Which actions to show is a display-only read of provider + status: COD and
 * MANUAL (admin-entered offline orders) have no gateway, so their
 * mark-paid/mark-failed/mark-refunded staff actions are exclusive to those
 * two providers server-side (422 PAYMENTS_STAFF_ACTION_UNSUPPORTED for any
 * other provider — see payments.service.ts#requireCodPayment), while a
 * gateway-backed payment (e.g. MOCK) only ever exposes the gateway-calling
 * refund. The backend re-validates regardless.
 */
export function PaymentActions({ payment, canUpdate, canRefund }: PaymentActionsProps) {
  const router = useRouter();
  const [target, setTarget] = useState<PaymentActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStaffAttested = payment.provider === "COD" || payment.provider === "MANUAL";
  const isRefundable = payment.status === "PAID" || payment.status === "PARTIALLY_REFUNDED";

  const actions: { kind: PaymentActionKind; label: string }[] = [];
  if (canUpdate && isStaffAttested && payment.status === "PENDING") {
    actions.push({ kind: "mark-paid", label: "Mark paid" });
    actions.push({ kind: "mark-failed", label: "Mark failed" });
  }
  if (canRefund && isRefundable) {
    actions.push({
      kind: isStaffAttested ? "mark-refunded" : "refund",
      label: isStaffAttested ? "Mark refunded" : "Refund",
    });
  }

  if (actions.length === 0) return null;

  function close() {
    setTarget(null);
    setReason("");
    setAmount("");
    setReference("");
    setError(null);
  }

  async function confirm() {
    if (!target) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const amountValue = amount.trim() ? Number(amount.trim()) : undefined;
      switch (target) {
        case "mark-paid":
          await markPaymentPaid(payment.id);
          break;
        case "mark-failed":
          await markPaymentFailed(payment.id, reason.trim());
          break;
        case "mark-refunded":
          await markPaymentRefunded(payment.id, {
            ...(amountValue !== undefined ? { amount: amountValue } : {}),
            ...(reference.trim() ? { reference: reference.trim() } : {}),
          });
          break;
        case "refund":
          await refundPayment(payment.id, amountValue !== undefined ? { amount: amountValue } : {});
          break;
      }
      close();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(PAYMENTS_ERROR_MESSAGES[err.code ?? ""] ?? err.message);
        if (err.status === 409 || err.status === 422) router.refresh();
      } else {
        setError("Couldn't complete this action. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const titles: Record<PaymentActionKind, string> = {
    "mark-paid": "Mark this payment as paid?",
    "mark-failed": "Mark this payment as failed?",
    "mark-refunded": "Mark this payment as refunded?",
    refund: "Refund this payment?",
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.kind}
          size="sm"
          variant={action.kind === "mark-failed" ? "outline" : "primary"}
          className={action.kind === "mark-failed" ? "border-error text-error" : undefined}
          onClick={() => {
            setError(null);
            setTarget(action.kind);
          }}
        >
          {action.label}
        </Button>
      ))}

      {target ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) close();
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="payment-action-dialog-title" className="w-full max-w-md rounded-lg bg-surface p-6 shadow-lg">
            <h2 id="payment-action-dialog-title" className="text-lg font-semibold text-text">
              {titles[target]}
            </h2>

            {target === "mark-failed" ? (
              <>
                <label className="mt-4 block text-sm font-medium text-text" htmlFor="payment-fail-reason">
                  Reason
                </label>
                <textarea
                  id="payment-fail-reason"
                  value={reason}
                  maxLength={255}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm text-text"
                />
              </>
            ) : null}

            {target === "mark-refunded" || target === "refund" ? (
              <>
                <label className="mt-4 block text-sm font-medium text-text" htmlFor="payment-refund-amount">
                  Amount (leave blank to refund the full remaining amount)
                </label>
                <input
                  id="payment-refund-amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm text-text"
                />
              </>
            ) : null}

            {target === "mark-refunded" ? (
              <>
                <label className="mt-4 block text-sm font-medium text-text" htmlFor="payment-refund-reference">
                  Reference (optional)
                </label>
                <input
                  id="payment-refund-reference"
                  type="text"
                  maxLength={255}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm text-text"
                />
              </>
            ) : null}

            {error ? (
              <p role="alert" className="mt-3 text-sm text-error">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={close} disabled={isSubmitting}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={confirm}
                isLoading={isSubmitting}
                disabled={target === "mark-failed" && reason.trim().length === 0}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
