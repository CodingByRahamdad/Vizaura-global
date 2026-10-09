"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { deleteAdminReview, updateAdminReview } from "@/lib/api/admin/reviews-mutations";

interface ReviewLifecycleActionsProps {
  reviewId: string;
  isPublished: boolean;
  isFeatured: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

/** Publish/unpublish is moderation (hide without deleting); feature toggles homepage/About eligibility; delete is permanent. */
export function ReviewLifecycleActions({ reviewId, isPublished, isFeatured, canUpdate, canDelete }: ReviewLifecycleActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"publish" | "feature" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function togglePublished() {
    setPending("publish");
    setError(null);
    try {
      await updateAdminReview(reviewId, { isPublished: !isPublished });
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't update the review.");
    } finally {
      setPending(null);
    }
  }

  async function toggleFeatured() {
    setPending("feature");
    setError(null);
    try {
      await updateAdminReview(reviewId, { isFeatured: !isFeatured });
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't update the review.");
    } finally {
      setPending(null);
    }
  }

  async function handleDelete() {
    setPending("delete");
    setError(null);
    try {
      await deleteAdminReview(reviewId);
      router.push("/admin/reviews");
    } catch (submitError) {
      setConfirmingDelete(false);
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't delete the review.");
      setPending(null);
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
          <>
            <Button variant="outline" size="sm" onClick={() => void togglePublished()} isLoading={pending === "publish"}>
              {isPublished ? "Unpublish" : "Publish"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void toggleFeatured()} isLoading={pending === "feature"}>
              {isFeatured ? "Unfeature" : "Feature"}
            </Button>
          </>
        ) : null}
        {canDelete ? (
          <Button variant="outline" size="sm" className="text-error" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        ) : null}
      </div>

      <AdminConfirmDialog
        open={confirmingDelete}
        title="Delete this review?"
        description="This permanently deletes the review and removes it from every public page. This cannot be undone."
        confirmLabel="Delete"
        destructive
        isSubmitting={pending === "delete"}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
