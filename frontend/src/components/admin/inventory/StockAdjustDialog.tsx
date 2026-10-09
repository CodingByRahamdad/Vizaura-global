"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { ApiError } from "@/lib/api";
import { adjustStock } from "@/lib/api/admin/inventory";

interface StockAdjustDialogProps {
  open: boolean;
  productId: string;
  variantId: string;
  marketCode: string;
  productName: string;
  currentOnHand: number;
  onClose: () => void;
}

/**
 * The only inventory write action this phase — reuses the existing
 * inventory:update-gated adjust endpoint (already atomic, already writes a
 * StockMovement + AuditLog row server-side). "Current stock -> adjustment
 * -> reason -> new stock", never a directly-editable "available" (always
 * derived, never itself writable).
 */
export function StockAdjustDialog({
  open,
  productId,
  variantId,
  marketCode,
  productName,
  currentOnHand,
  onClose,
}: StockAdjustDialogProps) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const deltaValue = Number(delta);
  const isValidDelta = delta.trim() !== "" && Number.isInteger(deltaValue) && deltaValue !== 0;
  const newOnHand = isValidDelta ? currentOnHand + deltaValue : currentOnHand;

  async function handleSubmit() {
    if (!isValidDelta || !reason.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await adjustStock(productId, variantId, marketCode, { delta: deltaValue, reason: reason.trim() });
      setDelta("");
      setReason("");
      onClose();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't adjust stock.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="stock-adjust-title" className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-lg">
        <h2 id="stock-adjust-title" className="text-lg font-semibold text-text">
          Adjust stock — {productName} ({marketCode})
        </h2>
        {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}

        <div className="mt-4 flex flex-col gap-3">
          <FormField label="Adjustment (+/-)" htmlFor="stock-adjust-delta" required>
            <Input
              id="stock-adjust-delta"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              inputMode="numeric"
              placeholder="e.g. 20 or -5"
            />
          </FormField>
          <FormField label="Reason" htmlFor="stock-adjust-reason" required>
            <Input
              id="stock-adjust-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Supplier delivery, stock count correction"
            />
          </FormField>
          <p className="text-sm text-text-secondary">
            Current on hand: <strong>{currentOnHand}</strong> → New on hand:{" "}
            <strong>{isValidDelta ? newOnHand : "—"}</strong>
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={!isValidDelta || !reason.trim()}
          >
            Save Adjustment
          </Button>
        </div>
      </div>
    </div>
  );
}
