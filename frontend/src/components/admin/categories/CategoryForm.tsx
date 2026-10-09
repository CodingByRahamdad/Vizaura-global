"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SafeImage } from "@/components/ui/SafeImage";
import { ApiError } from "@/lib/api";
import { slugify } from "@/lib/utils/slugify";
import { createCategory, updateCategory, uploadCategoryImage } from "@/lib/api/admin/categories-mutations";
import { revalidateCategoriesPages } from "@/lib/actions/revalidateCategories";
import type { CategoryResponse } from "@/lib/types/catalog";

interface CategoryFormProps {
  mode: "create" | "edit";
  category?: CategoryResponse;
  /** Every category (active + inactive), used for the parent picker. */
  allCategories: CategoryResponse[];
  canUpdate: boolean;
}

type FieldErrors = Partial<Record<"name" | "slug" | "parentId" | "description" | "imageUrl" | "position", string>>;

/**
 * Backend validation errors arrive either as zod-style
 * `{ fields: [{ path, message }] }` or as a flat `{ slug: "message" }`
 * (service-level checks). Only known form fields are surfaced.
 */
function toFieldErrors(details: unknown): FieldErrors {
  const errors: FieldErrors = {};
  if (!details || typeof details !== "object") return errors;
  const known = ["name", "slug", "parentId", "description", "imageUrl", "position"] as const;
  const record = details as Record<string, unknown>;
  if (Array.isArray(record.fields)) {
    for (const item of record.fields as { path?: string; message?: string }[]) {
      const key = known.find((k) => k === item.path);
      if (key && item.message) errors[key] = item.message;
    }
  }
  for (const key of known) {
    if (typeof record[key] === "string") errors[key] = record[key] as string;
  }
  return errors;
}

/**
 * The backend is the only authority on slug uniqueness and normalization; the
 * slug shown here is a preview derived with the same rule (lib/utils/slugify)
 * and is sent explicitly only if the admin edits it (create) — otherwise the
 * server derives it. Duplicate slugs (409) and parent cycles (422) come back
 * as ApiError messages and are shown inline.
 */
export function CategoryForm({ mode, category, allCategories, canUpdate }: CategoryFormProps) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? "");
  const [position, setPosition] = useState(String(category?.position ?? 0));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const parentOptions = [
    { label: "None (top level)", value: "" },
    ...allCategories
      .filter((c) => c.id !== category?.id)
      .map((c) => ({ label: c.isActive ? c.name : `${c.name} (inactive)`, value: c.id })),
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(false);

    const positionNumber = Number(position);
    if (!Number.isInteger(positionNumber) || positionNumber < 0) {
      setFieldErrors({ position: "Position must be a whole number, 0 or more." });
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "edit" && category) {
        await updateCategory(category.id, {
          name,
          slug: effectiveSlug,
          parentId: parentId || null,
          description: description.trim() || null,
          imageUrl: imageUrl.trim() || null,
          isActive,
          position: positionNumber,
        });
        setSaved(true);
        await revalidateCategoriesPages();
        router.refresh();
        return;
      }

      const created = await createCategory({
        name,
        // Sent only when the admin typed one; otherwise the backend derives it.
        slug: slugTouched && slug.trim() ? slug.trim() : undefined,
        parentId: parentId || undefined,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        isActive,
        position: positionNumber,
      });
      await revalidateCategoriesPages();
      router.push(`/admin/categories/${created.id}`);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        const fields = toFieldErrors(submitError.details);
        // A slug conflict has no field entry in `fields`; pin it to the slug input.
        if (submitError.code === "CATALOG_SLUG_CONFLICT") fields.slug = submitError.message;
        if (submitError.code === "CATALOG_INVALID_CATEGORY_PARENT") fields.parentId = submitError.message;
        setFieldErrors(fields);
        setError(Object.keys(fields).length > 0 ? "Please fix the highlighted fields." : submitError.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadCategoryImage(file);
      setImageUrl(url);
    } catch (uploadError) {
      setError(uploadError instanceof ApiError ? uploadError.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
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
          Category saved.
        </p>
      ) : null}

      <FormField label="Name" htmlFor="category-name" required error={fieldErrors.name}>
        <Input
          id="category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!canUpdate}
          invalid={!!fieldErrors.name}
          maxLength={150}
          required
        />
      </FormField>

      <FormField label="Slug" htmlFor="category-slug" required error={fieldErrors.slug}>
        <Input
          id="category-slug"
          value={effectiveSlug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          disabled={!canUpdate}
          invalid={!!fieldErrors.slug}
          required
        />
      </FormField>

      <FormField label="Parent category" htmlFor="category-parent" error={fieldErrors.parentId}>
        <Select
          id="category-parent"
          value={parentId}
          onChange={(event) => setParentId(event.target.value)}
          disabled={!canUpdate}
          options={parentOptions}
        />
      </FormField>

      <FormField label="Description" htmlFor="category-description" error={fieldErrors.description}>
        <textarea
          id="category-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={!canUpdate}
          rows={4}
          maxLength={5000}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </FormField>

      <FormField label="Image" htmlFor="category-image" error={fieldErrors.imageUrl}>
        <div className="flex flex-col gap-3">
          {imageUrl ? (
            <div className="h-32 w-32 overflow-hidden rounded-md border border-border">
              <SafeImage src={imageUrl} alt={name || "Category image preview"} />
            </div>
          ) : null}
          <div className="flex gap-2">
            <Input
              id="category-image"
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              disabled={!canUpdate}
              invalid={!!fieldErrors.imageUrl}
              placeholder="https://..."
            />
            {canUpdate ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Image
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </FormField>

      <FormField label="Position" htmlFor="category-position" error={fieldErrors.position}>
        <Input
          id="category-position"
          type="number"
          min={0}
          step={1}
          value={position}
          onChange={(event) => setPosition(event.target.value)}
          disabled={!canUpdate}
          invalid={!!fieldErrors.position}
        />
      </FormField>

      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          disabled={!canUpdate}
        />
        Active (visible on the storefront)
      </label>

      {canUpdate ? (
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "Create Category" : "Save Changes"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
