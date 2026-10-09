"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { updateOrderStatus, type UpdateOrderStatusInput } from "@/lib/api/admin/orders";
import type { OrderStatus } from "@/lib/types/checkout";
import { ORDER_STATUS_LABELS } from "@/lib/types/orders";
import {
  ADMIN_ORDERS_ERROR_MESSAGES,
  ORDER_NEXT_TRANSITIONS,
} from "@/lib/types/admin-orders";

interface OrderStatusActionsProps {
  orderId: string;
  currentStatus: OrderStatus;
  canUpdate: boolean;
  canCancel: boolean;
}

/**
 * Buttons are a UX convenience built from a display-only copy of the
 * backend's transition table; the backend re-validates every transition and
 * its permission, so a stale button can only produce a safe rejection.
 */
export function OrderStatusActions({ orderId, currentStatus, canUpdate, canCancel }: OrderStatusActionsProps) {
  const router = useRouter();
  const [target, setTarget] = useState<UpdateOrderStatusInput["status"] | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = (ORDER_NEXT_TRANSITIONS[currentStatus] ?? []).filter((t) =>
    t.permission === "cancel" ? canCancel : canUpdate
  );

  if (options.length === 0) {
    return <p className="text-sm text-text-secondary">No further status changes are available for this order.</p>;
  }

  function close() {
    setTarget(null);
    setReason("");
    setError(null);
  }

  async function confirm() {
    if (!target) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateOrderStatus(orderId, { status: target, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      close();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(ADMIN_ORDERS_ERROR_MESSAGES[err.code ?? ""] ?? err.message);
        // Stale state (409/422): reload so the buttons reflect the real status.
        if (err.status === 409 || err.status === 422) router.refresh();
      } else {
        setError("Couldn't update the order status. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((t) => (
          <Button
            key={t.status}
            size="sm"
            variant={t.status === "CANCELLED" ? "outline" : "primary"}
            className={t.status === "CANCELLED" ? "border-error text-error" : undefined}
            onClick={() => {
              setError(null);
              setTarget(t.status as UpdateOrderStatusInput["status"]);
            }}
          >
            {t.status === "CANCELLED" ? "Cancel order" : `Mark as ${ORDER_STATUS_LABELS[t.status]}`}
          </Button>
        ))}
      </div>

      {target ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-status-dialog-title"
            className="w-full max-w-md rounded-lg bg-surface p-6 shadow-lg"
          >
            <h2 id="order-status-dialog-title" className="text-lg font-semibold text-text">
              {target === "CANCELLED" ? "Cancel this order?" : `Mark order as ${ORDER_STATUS_LABELS[target]}?`}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {target === "CANCELLED"
                ? "Cancelling releases reserved stock and can't be undone."
                : "This is recorded in the order's status history."}
            </p>
            <label className="mt-4 block text-sm font-medium text-text" htmlFor="order-status-reason">
              Reason (optional)
            </label>
            <textarea
              id="order-status-reason"
              value={reason}
              maxLength={255}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm text-text"
            />
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
                variant={target === "CANCELLED" ? "primary" : "secondary"}
                className={target === "CANCELLED" ? "bg-error hover:bg-error/90" : undefined}
                onClick={confirm}
                isLoading={isSubmitting}
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
