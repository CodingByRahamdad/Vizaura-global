"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Recaptcha, type RecaptchaHandle } from "@/components/ui/Recaptcha";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { deleteReview, submitReview, updateReview } from "@/lib/api/reviews-mutations";
import type { ReviewResponse } from "@/lib/types/reviews";
import { cn } from "@/lib/utils/cn";

const CAPTCHA_ERROR_CODES = new Set(["AUTH_CAPTCHA_FAILED", "AUTH_CAPTCHA_REQUIRED", "CAPTCHA_UNAVAILABLE"]);

interface WriteReviewFormProps {
  productId: string;
  /** The current visitor's own existing review, if any — switches the form into edit mode. */
  existingReview: ReviewResponse | null;
}

/**
 * Customer self-service submission/edit — the only write path a signed-out
 * or signed-in-but-unreviewed visitor sees. Ownership is structural
 * server-side (reviews.service.ts resolves userId from the session, never
 * the request body), so this form never sends a userId. Verified-purchase
 * status is computed once by the backend at submission time and is never a
 * form field here.
 */
export function WriteReviewForm({ productId, existingReview }: WriteReviewFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const recaptchaRef = useRef<RecaptchaHandle>(null);

  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [title, setTitle] = useState(existingReview?.title ?? "");
  const [body, setBody] = useState(existingReview?.body ?? "");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (status === "loading") return null;

  if (status !== "authenticated") {
    return (
      <div id="write-review" className="rounded-lg border border-border p-4 text-sm text-text-secondary">
        <a href={`/login?redirect=${encodeURIComponent(pathname)}`} className="font-medium text-primary hover:underline">
          Sign in
        </a>{" "}
        to write a review.
      </div>
    );
  }

  const isEdit = existingReview !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (rating < 1) {
      setError("Please select a star rating.");
      return;
    }

    if (!isEdit && !captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && existingReview) {
        await updateReview(existingReview.id, { rating, title: title.trim() || null, body: body.trim() });
      } else {
        await submitReview(productId, { rating, title: title.trim() || undefined, body: body.trim(), captchaToken: captchaToken! });
      }
      setSaved(true);
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
      router.refresh();
    } catch (submitError) {
      if (submitError instanceof ApiError && CAPTCHA_ERROR_CODES.has(submitError.code ?? "")) {
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
        setError("CAPTCHA verification failed. Please complete the checkbox again.");
      } else if (submitError instanceof ApiError) {
        setError(submitError.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!existingReview) return;
    setIsDeleting(true);
    try {
      await deleteReview(existingReview.id);
      setConfirmingDelete(false);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : "Couldn't delete your review.");
      setConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div id="write-review" className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-semibold text-text">{isEdit ? "Edit your review" : "Write a review"}</h3>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            Thanks — your review has been saved.
          </p>
        ) : null}

        <FormField label="Your rating" htmlFor="review-rating" required>
          <div className="flex items-center gap-1" id="review-rating">
            {Array.from({ length: 5 }, (_, index) => {
              const value = index + 1;
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  onClick={() => setRating(value)}
                  className="p-0.5"
                >
                  <Star className={cn("h-6 w-6", value <= rating ? "fill-warning text-warning" : "text-border")} />
                </button>
              );
            })}
          </div>
        </FormField>

        <FormField label="Title (optional)" htmlFor="review-title">
          <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
        </FormField>

        <FormField label="Your review" htmlFor="review-body" required>
          <Textarea
            id="review-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            minLength={10}
            maxLength={2000}
            required
            placeholder="Share your experience with this product..."
          />
        </FormField>

        {!isEdit ? <Recaptcha ref={recaptchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} /> : null}

        <div className="flex items-center justify-between gap-3">
          <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
            {isEdit ? "Save Changes" : "Submit Review"}
          </Button>
          {isEdit ? (
            <Button type="button" variant="outline" size="sm" className="text-error" onClick={() => setConfirmingDelete(true)}>
              Delete my review
            </Button>
          ) : null}
        </div>
      </form>

      <AdminConfirmDialog
        open={confirmingDelete}
        title="Delete your review?"
        description="This permanently removes your review. This cannot be undone."
        confirmLabel="Delete"
        destructive
        isSubmitting={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
