"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ApiError } from "@/lib/api";
import { createAdminReview, updateAdminReview } from "@/lib/api/admin/reviews-mutations";
import type { AdminReviewResponse } from "@/lib/types/admin-reviews";

interface ReviewFormProps {
  mode: "create" | "edit";
  review?: AdminReviewResponse;
  /** Active products for the picker. May be empty (e.g. the caller lacks products:read) — falls back to a manual id field. */
  products: { id: string; name: string }[];
  canUpdate: boolean;
}

type FieldErrors = Partial<Record<"productId" | "rating" | "body" | "authorName" | "avatarUrl", string>>;

function toFieldErrors(details: unknown): FieldErrors {
  const errors: FieldErrors = {};
  if (!details || typeof details !== "object") return errors;
  const known = ["productId", "rating", "body", "authorName", "avatarUrl"] as const;
  const record = details as Record<string, unknown>;
  if (Array.isArray(record.fields)) {
    for (const item of record.fields as { path?: string; message?: string }[]) {
      const key = known.find((k) => k === item.path);
      if (key && item.message) errors[key] = item.message;
    }
  }
  return errors;
}

/**
 * Admin-authored review (testimonial, or transcribed from an off-platform
 * source). `source`/`isVerifiedPurchase` are never form fields — the backend
 * always forces source="ADMIN" and isVerifiedPurchase=false on every write
 * through this form, shown here only as read-only badges in edit mode.
 * `userId` is optional: leaving it blank is the normal case for a quoted
 * testimonial with no backing account (reviews.repository.ts's nullable
 * userId exists exactly for this).
 */
export function ReviewForm({ mode, review, products, canUpdate }: ReviewFormProps) {
  const router = useRouter();
  const [productId, setProductId] = useState(review?.productId ?? products[0]?.id ?? "");
  const [userId, setUserId] = useState(review?.userId ?? "");
  const [rating, setRating] = useState(String(review?.rating ?? 5));
  const [title, setTitle] = useState(review?.title ?? "");
  const [body, setBody] = useState(review?.body ?? "");
  const [authorName, setAuthorName] = useState(review?.authorName ?? "");
  const [authorLocation, setAuthorLocation] = useState(review?.authorLocation ?? "");
  const [avatarUrl, setAvatarUrl] = useState(review?.avatarUrl ?? "");
  const [isPublished, setIsPublished] = useState(review?.isPublished ?? true);
  const [isFeatured, setIsFeatured] = useState(review?.isFeatured ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(false);
    setIsSubmitting(true);

    try {
      if (mode === "edit" && review) {
        await updateAdminReview(review.id, {
          rating: Number(rating),
          title: title.trim() || null,
          body: body.trim(),
          authorName: authorName.trim(),
          authorLocation: authorLocation.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
          isPublished,
          isFeatured,
        });
        setSaved(true);
        router.refresh();
        return;
      }

      const created = await createAdminReview({
        productId,
        userId: userId.trim() || undefined,
        rating: Number(rating),
        title: title.trim() || undefined,
        body: body.trim(),
        authorName: authorName.trim(),
        authorLocation: authorLocation.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        isPublished,
        isFeatured,
      });
      router.push(`/admin/reviews/${created.id}`);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        const fields = toFieldErrors(submitError.details);
        setFieldErrors(fields);
        setError(Object.keys(fields).length > 0 ? "Please fix the highlighted fields." : submitError.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error ? (
        <p role="alert" className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          Review saved.
        </p>
      ) : null}

      {mode === "edit" && review ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant={review.source === "CUSTOMER" ? "success" : "neutral"}>{review.source}</Badge>
          {review.isVerifiedPurchase ? <Badge variant="success">Verified Purchase</Badge> : null}
        </div>
      ) : null}

      {mode === "create" ? (
        <FormField label="Product" htmlFor="review-product" required error={fieldErrors.productId}>
          {products.length > 0 ? (
            <Select
              id="review-product"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              options={products.map((p) => ({ label: p.name, value: p.id }))}
              required
            />
          ) : (
            <Input
              id="review-product"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              placeholder="Product id (UUID)"
              invalid={!!fieldErrors.productId}
              required
            />
          )}
        </FormField>
      ) : (
        <p className="text-sm text-text-secondary">Product: {review?.productId}</p>
      )}

      {mode === "create" ? (
        <FormField label="Existing customer account (optional)" htmlFor="review-user">
          <Input
            id="review-user"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="User id (UUID) — leave blank for a quoted testimonial with no account"
          />
        </FormField>
      ) : null}

      <FormField label="Rating" htmlFor="review-rating" required error={fieldErrors.rating}>
        <Select
          id="review-rating"
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          disabled={!canUpdate}
          options={[5, 4, 3, 2, 1].map((n) => ({ label: `${n} star${n === 1 ? "" : "s"}`, value: String(n) }))}
        />
      </FormField>

      <FormField label="Title (optional)" htmlFor="review-title">
        <Input id="review-title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canUpdate} maxLength={150} />
      </FormField>

      <FormField label="Review text" htmlFor="review-body" required error={fieldErrors.body}>
        <Textarea
          id="review-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={!canUpdate}
          invalid={!!fieldErrors.body}
          maxLength={2000}
          required
        />
      </FormField>

      <FormField label="Reviewer name" htmlFor="review-author-name" required error={fieldErrors.authorName}>
        <Input
          id="review-author-name"
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          disabled={!canUpdate}
          invalid={!!fieldErrors.authorName}
          maxLength={150}
          required
        />
      </FormField>

      <FormField label="Reviewer location (optional)" htmlFor="review-author-location">
        <Input
          id="review-author-location"
          value={authorLocation}
          onChange={(event) => setAuthorLocation(event.target.value)}
          disabled={!canUpdate}
          maxLength={120}
        />
      </FormField>

      <FormField label="Avatar URL (optional)" htmlFor="review-avatar" error={fieldErrors.avatarUrl}>
        <Input
          id="review-avatar"
          type="url"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          disabled={!canUpdate}
          invalid={!!fieldErrors.avatarUrl}
          placeholder="https://..."
        />
      </FormField>

      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} disabled={!canUpdate} />
        Published (visible on the storefront)
      </label>

      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} disabled={!canUpdate} />
        Featured (eligible for the Homepage/About testimonial band)
      </label>

      {canUpdate ? (
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "Create Review" : "Save Changes"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
