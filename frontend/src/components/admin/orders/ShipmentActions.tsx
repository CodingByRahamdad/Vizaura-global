"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { updateShipment } from "@/lib/api/admin/shipments";
import type { AdminOrderShipment, ShipmentStatus } from "@/lib/types/admin-orders";
import {
  ORDER_TERMINAL_STATUSES,
  SHIPMENT_CANCELLATION_OUTCOME_STATUSES,
  SHIPMENT_ERROR_MESSAGES,
  SHIPMENT_NEXT_TRANSITIONS,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/types/admin-orders";
import type { OrderStatus } from "@/lib/types/checkout";

interface ShipmentActionsProps {
  shipment: AdminOrderShipment;
  canUpdate: boolean;
  orderStatus: OrderStatus;
}

/**
 * Buttons are a display-only copy of the backend's SHIPMENT_TRANSITIONS
 * table; tracking number / carrier are edited alongside whichever status
 * change is confirmed, since the backend exposes a single PATCH endpoint
 * for both (no separate tracking-only route).
 */
export function ShipmentActions({ shipment, canUpdate, orderStatus }: ShipmentActionsProps) {
  const router = useRouter();
  const [target, setTarget] = useState<ShipmentStatus | null>(null);
  const [trackingNumber, setTrackingNumber] = useState(shipment.trackingNumber ?? "");
  const [carrier, setCarrier] = useState(shipment.carrier ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canUpdate) return null;

  // A CANCELLED order may only record what happened to an already-dispatched
  // shipment (ITEM_RETURNED/ITEM_LOST); every other terminal order status
  // blocks shipment edits entirely; an active order can do everything except
  // those two cancellation-only outcomes. Mirrors the backend's
  // assertOrderShippable (shipments.service.ts) so we never show a button
  // the API will always reject.
  const rawOptions = SHIPMENT_NEXT_TRANSITIONS[shipment.status] ?? [];
  const options =
    orderStatus === "CANCELLED"
      ? rawOptions.filter((status) => SHIPMENT_CANCELLATION_OUTCOME_STATUSES.has(status))
      : ORDER_TERMINAL_STATUSES.has(orderStatus)
        ? []
        : rawOptions.filter((status) => !SHIPMENT_CANCELLATION_OUTCOME_STATUSES.has(status));
  if (options.length === 0) {
    return <p className="mt-2 text-sm text-text-secondary">No further shipment status changes are available.</p>;
  }

  function close() {
    setTarget(null);
    setError(null);
  }

  async function confirm() {
    if (!target) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateShipment(shipment.id, {
        status: target,
        ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
        ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
      });
      close();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(SHIPMENT_ERROR_MESSAGES[err.code ?? ""] ?? err.message);
        if (err.status === 409 || err.status === 422) router.refresh();
      } else {
        setError("Couldn't update the shipment. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((status) => (
        <Button
          key={status}
          size="sm"
          variant={status === "CANCELLED" ? "outline" : "primary"}
          className={status === "CANCELLED" ? "border-error text-error" : undefined}
          onClick={() => {
            setError(null);
            setTarget(status);
          }}
        >
          {status === "CANCELLED" ? "Cancel shipment" : `Mark as ${SHIPMENT_STATUS_LABELS[status]}`}
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
          <div role="dialog" aria-modal="true" aria-labelledby="shipment-dialog-title" className="w-full max-w-md rounded-lg bg-surface p-6 shadow-lg">
            <h2 id="shipment-dialog-title" className="text-lg font-semibold text-text">
              {target === "CANCELLED" ? "Cancel this shipment?" : `Mark shipment as ${SHIPMENT_STATUS_LABELS[target]}?`}
            </h2>

            <label className="mt-4 block text-sm font-medium text-text" htmlFor="shipment-tracking">
              Tracking number (optional)
            </label>
            <input
              id="shipment-tracking"
              type="text"
              maxLength={100}
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm text-text"
            />

            <label className="mt-4 block text-sm font-medium text-text" htmlFor="shipment-carrier">
              Carrier (optional)
            </label>
            <input
              id="shipment-carrier"
              type="text"
              maxLength={100}
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
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
