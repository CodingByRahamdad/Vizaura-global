"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminRowActionsMenu, type AdminRowActionItem } from "@/components/admin/AdminRowActionsMenu";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { deleteProduct, setProductActive } from "@/lib/api/admin/products";

interface ProductRowActionsProps {
  productId: string;
  productName: string;
  isActive: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function ProductRowActions({
  productId,
  productName,
  isActive,
  canUpdate,
  canDelete,
}: ProductRowActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleActive() {
    setPending(true);
    setError(null);
    try {
      await setProductActive(productId, !isActive);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't update product status.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      await deleteProduct(productId);
      setConfirmingDelete(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't delete product.");
    } finally {
      setPending(false);
    }
  }

  const items: AdminRowActionItem[] = [];
  if (canUpdate) {
    items.push({
      label: isActive ? "Mark Inactive" : "Mark Active",
      onSelect: handleToggleActive,
    });
  }
  items.push({
    label: "Update",
    onSelect: () => router.push(`/admin/products/${productId}`),
  });
  if (canDelete) {
    items.push({
      label: "Delete",
      destructive: true,
      onSelect: () => setConfirmingDelete(true),
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <p className="text-xs text-error">{error}</p> : null}
      <AdminRowActionsMenu items={items} label={`Actions for ${productName}`} />

      <AdminConfirmDialog
        open={confirmingDelete}
        title={`Permanently delete "${productName}"?`}
        description="This permanently deletes the product and cannot be undone. Any customer reviews, wishlist entries, and live cart items referencing this product will also be permanently removed. Order history is preserved."
        confirmLabel="Delete"
        destructive
        isSubmitting={pending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
