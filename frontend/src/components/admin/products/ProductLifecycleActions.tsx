"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { archiveProduct, deleteProduct, updateProduct } from "@/lib/api/admin/products";

interface ProductLifecycleActionsProps {
  productId: string;
  status: string;
  canUpdate: boolean;
  canDelete: boolean;
}

/**
 * Archive (status -> ARCHIVED) is the primary "remove from catalog" action —
 * reversible, and already sufficient to hide from customers since the
 * storefront filters non-ACTIVE products. Hard delete is scoped in this UI
 * to DRAFT products only; the backend endpoint itself has no status check,
 * so this restriction is a UI convention, not a backend guarantee (see
 * docs/MODULE_STATUS.md's known-limitations note).
 */
export function ProductLifecycleActions({ productId, status, canUpdate, canDelete }: ProductLifecycleActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"archive" | "delete" | "restore" | null>(null);
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setPendingAction("archive");
    setError(null);
    try {
      await archiveProduct(productId);
      setConfirming(null);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't archive product.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRestore() {
    setPendingAction("restore");
    setError(null);
    try {
      await updateProduct(productId, { status: "DRAFT" });
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't restore product.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    setPendingAction("delete");
    setError(null);
    try {
      await deleteProduct(productId);
      router.push("/admin/products");
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't delete product.");
      setPendingAction(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <div className="flex gap-2">
        {canUpdate && status !== "ARCHIVED" ? (
          <Button variant="outline" size="sm" onClick={() => setConfirming("archive")}>
            Archive
          </Button>
        ) : null}
        {canUpdate && status === "ARCHIVED" ? (
          <Button variant="outline" size="sm" onClick={handleRestore} isLoading={pendingAction === "restore"}>
            Restore to Draft
          </Button>
        ) : null}
        {canDelete && status === "DRAFT" ? (
          <Button variant="outline" size="sm" className="text-error" onClick={() => setConfirming("delete")}>
            Delete Draft
          </Button>
        ) : null}
      </div>

      <AdminConfirmDialog
        open={confirming === "archive"}
        title="Archive this product?"
        description="It will be immediately hidden from the storefront in both markets. You can restore it to Draft at any time."
        confirmLabel="Archive"
        isSubmitting={pendingAction === "archive"}
        onConfirm={handleArchive}
        onCancel={() => setConfirming(null)}
      />
      <AdminConfirmDialog
        open={confirming === "delete"}
        title="Delete this draft product?"
        description="This permanently deletes the product. This cannot be undone."
        confirmLabel="Delete"
        destructive
        isSubmitting={pendingAction === "delete"}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
