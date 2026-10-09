"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { updateShipment } from "@/lib/api/admin/shipments";
import type { ShipmentStatus } from "@/lib/types/admin-orders";
import {
  ORDER_TERMINAL_STATUSES,
  SHIPMENT_CANCELLATION_OUTCOME_STATUSES,
  SHIPMENT_ERROR_MESSAGES,
  SHIPMENT_NEXT_TRANSITIONS,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/types/admin-orders";
import type { OrderStatus } from "@/lib/types/checkout";
import { OrderShipmentBadge } from "./OrderBadges";

interface ShipmentInlineStatusSelectProps {
  shipmentId: string | null;
  status: ShipmentStatus;
  orderStatus: OrderStatus;
  canUpdate: boolean;
}

/**
 * List-page counterpart to ShipmentActions.tsx — same display-only read of
 * SHIPMENT_NEXT_TRANSITIONS, same PATCH /admin/shipments/:id endpoint, but
 * applies immediately on change. CANCELLED still gets an inline confirm.
 * Tracking number/carrier stay detail-page-only edits.
 */
export function ShipmentInlineStatusSelect({ shipmentId, status, orderStatus, canUpdate }: ShipmentInlineStatusSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState<ShipmentStatus>(status);
  const [prevStatus, setPrevStatus] = useState(status);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Adjusting state during render" (not an effect) — see
  // OrderInlineStatusSelect.tsx for why this avoids the setState-in-effect
  // render cascade a useEffect version of this would cause.
  if (status !== prevStatus) {
    setPrevStatus(status);
    setValue(status);
  }

  // Same CANCELLED-order carve-out as ShipmentActions.tsx — see the comment
  // there and backend's assertOrderShippable (shipments.service.ts).
  const rawOptions = canUpdate ? SHIPMENT_NEXT_TRANSITIONS[status] ?? [] : [];
  const options =
    orderStatus === "CANCELLED"
      ? rawOptions.filter((s) => SHIPMENT_CANCELLATION_OUTCOME_STATUSES.has(s))
      : ORDER_TERMINAL_STATUSES.has(orderStatus)
        ? []
        : rawOptions.filter((s) => !SHIPMENT_CANCELLATION_OUTCOME_STATUSES.has(s));

  if (!shipmentId || options.length === 0) {
    return <OrderShipmentBadge status={status} />;
  }
  const resolvedShipmentId: string = shipmentId;

  async function apply(target: ShipmentStatus) {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateShipment(resolvedShipmentId, { status: target });
      setConfirmingCancel(false);
      router.refresh();
    } catch (err) {
      setValue(status);
      setConfirmingCancel(false);
      if (err instanceof ApiError) {
        setError(SHIPMENT_ERROR_MESSAGES[err.code ?? ""] ?? err.message);
        if (err.status === 409 || err.status === 422) router.refresh();
      } else {
        setError("Couldn't update the shipment.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (confirmingCancel) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-error">Cancel shipment?</span>
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
        aria-label="Shipment status"
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text disabled:opacity-60"
        value={value}
        disabled={isSubmitting}
        onChange={(event) => {
          const next = event.target.value as ShipmentStatus;
          setValue(next);
          if (next === status) return;
          if (next === "CANCELLED") {
            setConfirmingCancel(true);
            return;
          }
          void apply(next);
        }}
      >
        <option value={status}>{SHIPMENT_STATUS_LABELS[status]}</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {SHIPMENT_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </div>
  );
}
