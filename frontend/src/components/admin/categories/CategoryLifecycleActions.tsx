"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { deleteCategory, updateCategory } from "@/lib/api/admin/categories-mutations";

interface CategoryLifecycleActionsProps {
  categoryId: string;
  isActive: boolean;
  /** Every product link (any status) and direct subcategories — what the backend delete guard checks. */
  productCount: number;
  childCount: number;
  canUpdate: boolean;
  canDelete: boolean;
}

/**
 * Deactivate/Activate (PATCH isActive) is the archive path: it hides the
 * category from the storefront but keeps every product link. Hard delete is
 * offered only when nothing references the category; the backend enforces the
 * same rule (409 CATALOG_CATEGORY_IN_USE), so a stale count can only produce a
 * safe rejection message here, never a detached product.
 */
export function CategoryLifecycleActions({
  categoryId,
  isActive,
  productCount,
  childCount,
  canUpdate,
  canDelete,
}: CategoryLifecycleActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"toggle" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletable = productCount === 0 && childCount === 0;

  async function handleToggle() {
    setPending("toggle");
    setError(null);
    try {
      await updateCategory(categoryId, { isActive: !isActive });
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't update the category.");
    } finally {
      setPending(null);
    }
  }

  async function handleDelete() {
    setPending("delete");
    setError(null);
    try {
      await deleteCategory(categoryId);
      router.push("/admin/categories");
    } catch (submitError) {
      setConfirmingDelete(false);
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't delete the category.");
      setPending(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? (
        <p role="alert" className="max-w-xs text-right text-sm text-error">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {canUpdate ? (
          <Button variant="outline" size="sm" onClick={handleToggle} isLoading={pending === "toggle"}>
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        ) : null}
        {canDelete && deletable ? (
          <Button variant="outline" size="sm" className="text-error" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        ) : null}
      </div>
      {canDelete && !deletable ? (
        <p className="max-w-xs text-right text-xs text-text-secondary">
          Can&apos;t be deleted while it has {productCount > 0 ? `${productCount} product link(s)` : ""}
          {productCount > 0 && childCount > 0 ? " and " : ""}
          {childCount > 0 ? `${childCount} subcategor${childCount === 1 ? "y" : "ies"}` : ""}. Deactivate it to hide it
          instead.
        </p>
      ) : null}

      <AdminConfirmDialog
        open={confirmingDelete}
        title="Delete this category?"
        description="This permanently deletes the category. It has no products or subcategories. This cannot be undone."
        confirmLabel="Delete"
        destructive
        isSubmitting={pending === "delete"}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
