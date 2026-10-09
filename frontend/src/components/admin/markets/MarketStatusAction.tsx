"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { updateMarketStatus } from "@/lib/api/admin/markets";
import { ADMIN_MARKETS_ERROR_MESSAGES } from "@/lib/types/markets";

interface MarketStatusActionProps {
  marketId: string;
  marketName: string;
  isActive: boolean;
  canManage: boolean;
}

/**
 * Toggles Market.isActive only — code/currency/timezone are fixed business
 * configuration, not editable here. Deactivating hides the market from the
 * public GET /markets list (and so the storefront switcher); it does not
 * touch existing orders, prices, or stock for that market. See
 * docs/modules/MARKETS.md.
 */
export function MarketStatusAction({ marketId, marketName, isActive, canManage }: MarketStatusActionProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  async function confirm() {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateMarketStatus(marketId, !isActive);
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ADMIN_MARKETS_ERROR_MESSAGES[err.code ?? ""] ?? err.message)
          : "Couldn't update this market. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? (
        <p role="alert" className="max-w-xs text-right text-sm text-error">
          {error}
        </p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className={isActive ? "text-error" : undefined}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>

      <AdminConfirmDialog
        open={confirming}
        title={isActive ? `Deactivate ${marketName}?` : `Activate ${marketName}?`}
        description={
          isActive
            ? "The storefront market switcher will stop offering this market. Existing orders, prices, and stock for it are unaffected."
            : "The storefront market switcher will offer this market again."
        }
        confirmLabel={isActive ? "Deactivate" : "Activate"}
        destructive={isActive}
        isSubmitting={isSubmitting}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
