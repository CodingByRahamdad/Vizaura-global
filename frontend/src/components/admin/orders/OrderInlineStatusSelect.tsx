"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { updateOrderStatus, type UpdateOrderStatusInput } from "@/lib/api/admin/orders";
import type { OrderStatus } from "@/lib/types/checkout";
import { ORDER_STATUS_LABELS } from "@/lib/types/orders";
import { ADMIN_ORDERS_ERROR_MESSAGES, ORDER_NEXT_TRANSITIONS } from "@/lib/types/admin-orders";
import { OrderStatusBadge } from "./OrderBadges";

interface OrderInlineStatusSelectProps {
  orderId: string;
  status: OrderStatus;
  canUpdate: boolean;
  canCancel: boolean;
}

/**
 * List-page counterpart to OrderStatusActions.tsx — same display-only read
 * of ORDER_NEXT_TRANSITIONS, same PATCH /admin/orders/:id/status endpoint,
 * but applies immediately on change instead of opening the detail page.
 * CANCELLED still gets an inline confirm step (not a full modal) since it
 * releases reserved stock and can't be undone.
 */
export function OrderInlineStatusSelect({ orderId, status, canUpdate, canCancel }: OrderInlineStatusSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState<OrderStatus>(status);
  const [prevStatus, setPrevStatus] = useState(status);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Adjusting state during render" (not an effect) — resyncs the select's
  // displayed value when the server-confirmed status prop actually changes
  // (e.g. after router.refresh()), without the setState-in-effect render
  // cascade a useEffect version of this would cause.
  if (status !== prevStatus) {
    setPrevStatus(status);
    setValue(status);
  }

  const options = (ORDER_NEXT_TRANSITIONS[status] ?? []).filter((t) => (t.permission === "cancel" ? canCancel : canUpdate));

  if (options.length === 0) {
    return <OrderStatusBadge status={status} />;
  }

  async function apply(target: UpdateOrderStatusInput["status"]) {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateOrderStatus(orderId, { status: target });
      setConfirmingCancel(false);
      router.refresh();
    } catch (err) {
      setValue(status);
      setConfirmingCancel(false);
      if (err instanceof ApiError) {
        setError(ADMIN_ORDERS_ERROR_MESSAGES[err.code ?? ""] ?? err.message);
        if (err.status === 409 || err.status === 422) router.refresh();
      } else {
        setError("Couldn't update the order status.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (confirmingCancel) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-error">Cancel order?</span>
          <button
            type="button"
            className="font-medium text-error underline disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => void apply("CANCELLED")}
          >
            Confirm
          </button>
          <button
            type="button"
            className="text-text-secondary underline disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => {
              setConfirmingCancel(false);
              setValue(status);
            }}
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
        aria-label="Order status"
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text disabled:opacity-60"
        value={value}
        disabled={isSubmitting}
        onChange={(event) => {
          const next = event.target.value as OrderStatus;
          setValue(next);
          if (next === status) return;
          if (next === "CANCELLED") {
            setConfirmingCancel(true);
            return;
          }
          void apply(next as UpdateOrderStatusInput["status"]);
        }}
      >
        <option value={status}>{ORDER_STATUS_LABELS[status]}</option>
        {options.map((t) => (
          <option key={t.status} value={t.status}>
            {ORDER_STATUS_LABELS[t.status]}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </div>
  );
}
