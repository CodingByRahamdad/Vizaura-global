"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { deleteCustomer } from "@/lib/api/admin/customers";
import { ADMIN_CUSTOMERS_ERROR_MESSAGES } from "@/lib/types/admin-customers";

interface CustomerDeleteActionProps {
  customerId: string;
  canDelete: boolean;
  orderCount: number;
}

/**
 * DELETE /admin/customers/:id hard-deletes the row when the customer has
 * zero orders, otherwise soft-deletes it (sets deletedAt) to preserve order
 * history — see backend/src/modules/users/users.service.ts#deleteCustomer.
 * Same confirm-dialog pattern as CustomerStatusActions.
 */
export function CustomerDeleteAction({ customerId, canDelete, orderCount }: CustomerDeleteActionProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canDelete) return null;

  async function confirm() {
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteCustomer(customerId);
      router.push("/admin/customers");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ADMIN_CUSTOMERS_ERROR_MESSAGES[err.code ?? ""] ?? err.message)
          : "Couldn't delete this customer. Please try again."
      );
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
        className="text-error"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        Delete customer
      </Button>

      <AdminConfirmDialog
        open={confirming}
        title="Delete this customer?"
        description={
          orderCount === 0
            ? "This permanently deletes the account — it has no orders, so there is nothing to preserve. This cannot be undone."
            : "This removes the account from the Customers list and revokes any active sessions. Order history is preserved."
        }
        confirmLabel="Delete"
        destructive
        isSubmitting={isSubmitting}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
