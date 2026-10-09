"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { deletePromotion, updatePromotion } from "@/lib/api/admin/promotions-mutations";
import type { AdminPromotionResponse } from "@/lib/types/promotions";

interface PromotionLifecycleActionsProps {
  promotion: AdminPromotionResponse;
  canUpdate: boolean;
  canDelete: boolean;
}

/** Mirrors CategoryLifecycleActions.tsx's Activate/Deactivate + Delete pattern. */
export function PromotionLifecycleActions({ promotion, canUpdate, canDelete }: PromotionLifecycleActionsProps) {
  const router = useRouter();
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleDraft() {
    setError(null);
    setIsToggling(true);
    try {
      await updatePromotion(promotion.id, { isDraft: !promotion.isDraft });
      router.refresh();
    } catch (toggleError) {
      setError(toggleError instanceof ApiError ? toggleError.message : "Something went wrong.");
    } finally {
      setIsToggling(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setIsDeleting(true);
    try {
      await deletePromotion(promotion.id);
      router.push("/admin/promotions");
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : "Something went wrong.");
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <p className="text-sm text-error">{error}</p> : null}
      {canUpdate ? (
        <Button type="button" variant="secondary" size="sm" isLoading={isToggling} onClick={handleToggleDraft}>
          {promotion.isDraft ? "Publish" : "Unpublish"}
        </Button>
      ) : null}
      {canDelete ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-error hover:bg-error/10"
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
          <AdminConfirmDialog
            open={confirmOpen}
            title="Delete this promotion?"
            description="This permanently removes the promotion. It will no longer be eligible to appear on the homepage."
            confirmLabel="Delete"
            destructive
            isSubmitting={isDeleting}
            onConfirm={handleDelete}
            onCancel={() => setConfirmOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
}
