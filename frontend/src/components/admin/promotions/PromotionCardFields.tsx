"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SafeImage } from "@/components/ui/SafeImage";
import { ApiError } from "@/lib/api";
import { searchAdminProducts } from "@/lib/api/admin/products";
import { uploadPromotionImage } from "@/lib/api/admin/promotions-mutations";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import type { PromotionTargetType } from "@/lib/types/promotions";
import type { CategoryResponse, ProductSummaryResponse } from "@/lib/types/catalog";

export interface PromotionCardValues {
  overline: string;
  title: string;
  subtitle: string;
  badgeText: string;
  discountPercent: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
  targetType: PromotionTargetType | "";
  targetProductId: string;
  targetProductLabel: string;
  targetCategoryId: string;
}

export const EMPTY_PROMOTION_CARD_VALUES: PromotionCardValues = {
  overline: "",
  title: "",
  subtitle: "",
  badgeText: "",
  discountPercent: "",
  ctaText: "",
  ctaLink: "",
  imageUrl: "",
  targetType: "",
  targetProductId: "",
  targetProductLabel: "",
  targetCategoryId: "",
};

export type CardFieldErrors = Partial<
  Record<
    "overline" | "title" | "subtitle" | "badgeText" | "discountPercent" | "ctaText" | "ctaLink" | "imageUrl" | "targetType",
    string
  >
>;

interface PromotionCardFieldsProps {
  /** Distinguishes DOM ids between the Grid 1 and Grid 2 instances (e.g. "promo", "promo-grid2"). */
  idPrefix: string;
  values: PromotionCardValues;
  onChange: (patch: Partial<PromotionCardValues>) => void;
  categories: CategoryResponse[];
  canUpdate: boolean;
  fieldErrors: CardFieldErrors;
  titleRequired?: boolean;
}

/**
 * The full set of content fields for one promotion card (overline/title/
 * subtitle/badge/discount/CTA/image upload/target picker). Rendered once
 * for SINGLE layout and twice for GRID layout (Grid 1 + Grid 2, each its
 * own independent instance with its own product-search state) by
 * PromotionForm.tsx. Owns only its own ephemeral product-search/upload UI
 * state — the actual field values live in the parent so submission stays
 * centralized in one place.
 */
export function PromotionCardFields({
  idPrefix,
  values,
  onChange,
  categories,
  canUpdate,
  fieldErrors,
  titleRequired = false,
}: PromotionCardFieldsProps) {
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductSummaryResponse[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const debouncedProductQuery = useDebouncedValue(productQuery, 300);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The short-query reset happens synchronously in the input's own onChange
  // below, not here — this effect only ever sets state from inside the
  // async .then/.catch below, after the debounced value settles (mirrors
  // AdminGlobalSearch.tsx's identical split, react-hooks/set-state-in-effect).
  useEffect(() => {
    const trimmed = debouncedProductQuery.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;
    searchAdminProducts(trimmed)
      .then((results) => {
        if (!cancelled) setProductResults(results);
      })
      .catch(() => {
        if (!cancelled) setProductResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedProductQuery]);

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadPromotionImage(file);
      onChange({ imageUrl: url });
    } catch (error) {
      setUploadError(error instanceof ApiError ? error.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  const categoryOptions = [
    { label: "Select a category…", value: "" },
    ...categories.map((c) => ({ label: c.isActive ? c.name : `${c.name} (inactive)`, value: c.id })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <FormField label="Overline" htmlFor={`${idPrefix}-overline`} error={fieldErrors.overline}>
        <Input
          id={`${idPrefix}-overline`}
          value={values.overline}
          onChange={(event) => onChange({ overline: event.target.value })}
          disabled={!canUpdate}
          maxLength={100}
          placeholder="Limited Time Offer"
        />
      </FormField>

      <FormField label="Title" htmlFor={`${idPrefix}-title`} required={titleRequired} error={fieldErrors.title}>
        <Input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={(event) => onChange({ title: event.target.value })}
          disabled={!canUpdate}
          invalid={!!fieldErrors.title}
          maxLength={200}
          required={titleRequired}
        />
      </FormField>

      <FormField label="Subtitle" htmlFor={`${idPrefix}-subtitle`} error={fieldErrors.subtitle}>
        <Input
          id={`${idPrefix}-subtitle`}
          value={values.subtitle}
          onChange={(event) => onChange({ subtitle: event.target.value })}
          disabled={!canUpdate}
          maxLength={500}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Badge text (optional override)" htmlFor={`${idPrefix}-badge`} error={fieldErrors.badgeText}>
          <Input
            id={`${idPrefix}-badge`}
            value={values.badgeText}
            onChange={(event) => onChange({ badgeText: event.target.value })}
            disabled={!canUpdate}
            maxLength={50}
            placeholder="e.g. Best Value"
          />
        </FormField>
        <FormField label="Discount %" htmlFor={`${idPrefix}-discount`} error={fieldErrors.discountPercent}>
          <Input
            id={`${idPrefix}-discount`}
            type="number"
            min={0}
            max={100}
            value={values.discountPercent}
            onChange={(event) => onChange({ discountPercent: event.target.value })}
            disabled={!canUpdate}
            invalid={!!fieldErrors.discountPercent}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="CTA button text" htmlFor={`${idPrefix}-cta-text`} error={fieldErrors.ctaText}>
          <Input
            id={`${idPrefix}-cta-text`}
            value={values.ctaText}
            onChange={(event) => onChange({ ctaText: event.target.value })}
            disabled={!canUpdate}
            maxLength={50}
          />
        </FormField>
        <FormField label="CTA link (optional override)" htmlFor={`${idPrefix}-cta-link`} error={fieldErrors.ctaLink}>
          <Input
            id={`${idPrefix}-cta-link`}
            value={values.ctaLink}
            onChange={(event) => onChange({ ctaLink: event.target.value })}
            disabled={!canUpdate}
            placeholder="Leave blank to use the target below"
          />
        </FormField>
      </div>

      <FormField label="Image" htmlFor={`${idPrefix}-image`} error={fieldErrors.imageUrl ?? uploadError ?? undefined}>
        <div className="flex flex-col gap-3">
          {values.imageUrl ? (
            <div className="h-32 w-full max-w-sm overflow-hidden rounded-md border border-border">
              <SafeImage src={values.imageUrl} alt={values.title || "Promotion image preview"} />
            </div>
          ) : null}
          <div className="flex gap-2">
            <Input
              id={`${idPrefix}-image`}
              type="url"
              value={values.imageUrl}
              onChange={(event) => onChange({ imageUrl: event.target.value })}
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

      <FormField label="Target" htmlFor={`${idPrefix}-target-type`} error={fieldErrors.targetType}>
        <div className="flex flex-col gap-3">
          <Select
            id={`${idPrefix}-target-type`}
            value={values.targetType}
            onChange={(event) => {
              const value = event.target.value as PromotionTargetType | "";
              onChange({
                targetType: value,
                targetProductId: "",
                targetProductLabel: "",
                targetCategoryId: "",
              });
              setProductQuery("");
            }}
            disabled={!canUpdate}
            options={[
              { label: "None (no target)", value: "" },
              { label: "Product", value: "PRODUCT" },
              { label: "Category", value: "CATEGORY" },
            ]}
          />

          {values.targetType === "PRODUCT" ? (
            values.targetProductId ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="truncate">{values.targetProductLabel}</span>
                {canUpdate ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                    onClick={() => onChange({ targetProductId: "", targetProductLabel: "" })}
                  >
                    Change
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={productQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setProductQuery(value);
                    if (value.trim().length < 2) setProductResults([]);
                  }}
                  disabled={!canUpdate}
                  placeholder="Search product by name…"
                />
                {productResults.length > 0 ? (
                  <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
                    {productResults.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-bg"
                          onClick={() => {
                            onChange({ targetProductId: product.id, targetProductLabel: product.name });
                            setProductQuery("");
                            setProductResults([]);
                          }}
                        >
                          {product.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          ) : null}

          {values.targetType === "CATEGORY" ? (
            <Select
              value={values.targetCategoryId}
              onChange={(event) => onChange({ targetCategoryId: event.target.value })}
              disabled={!canUpdate}
              options={categoryOptions}
            />
          ) : null}
        </div>
      </FormField>
    </div>
  );
}
