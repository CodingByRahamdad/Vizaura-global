"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { deleteAdminOrder } from "@/lib/api/admin/orders";

interface OrderAdminActionsProps {
  orderId: string;
  canUpdate: boolean;
  canDelete: boolean;
  /// Mirrors the backend's assertOrderIsMutable gate (every Payment PENDING,
  /// Shipment PENDING or absent, no returns) — computed by the server
  /// component from the already-fetched order detail, so Edit/Delete never
  /// link to an action the backend will just reject. The backend remains
  /// the sole authority; this is UX only.
  isMutable: boolean;
}

export function OrderAdminActions({ orderId, canUpdate, canDelete, isMutable }: OrderAdminActionsProps) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canUpdate && !canDelete) return null;
  if (!isMutable) {
    return (
      <p className="text-sm text-text-secondary">
        This order can no longer be edited or deleted — a payment or shipment has moved past pending, or a return exists.
      </p>
    );
  }

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAdminOrder(orderId);
      router.push("/admin/orders");
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : "Couldn't delete this order.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        {canUpdate ? (
          <Button variant="outline" size="sm" href={`/admin/orders/${orderId}/edit`}>
            Edit order
          </Button>
        ) : null}
        {canDelete ? (
          <Button variant="outline" size="sm" className="text-error" onClick={() => setConfirmingDelete(true)}>
            Delete order
          </Button>
        ) : null}
      </div>

      <AdminConfirmDialog
        open={confirmingDelete}
        title="Delete this order?"
        description="This permanently deletes the order, its items, addresses, payment, and shipment record. This cannot be undone."
        confirmLabel="Delete"
        destructive
        isSubmitting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
