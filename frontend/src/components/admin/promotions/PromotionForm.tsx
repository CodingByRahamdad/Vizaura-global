"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { PromoBannerSingle } from "@/components/home/PromoBannerSingle";
import { PromoBannerGrid } from "@/components/home/PromoBannerGrid";
import {
  PromotionCardFields,
  EMPTY_PROMOTION_CARD_VALUES,
  type CardFieldErrors,
  type PromotionCardValues,
} from "@/components/admin/promotions/PromotionCardFields";
import { ApiError } from "@/lib/api";
import {
  createPromotion,
  updatePromotion,
  type CreatePromotionInput,
} from "@/lib/api/admin/promotions-mutations";
import type { AdminPromotionResponse, PromotionDisplayLayout } from "@/lib/types/promotions";
import type { CategoryResponse } from "@/lib/types/catalog";

interface PromotionFormProps {
  mode: "create" | "edit";
  promotion?: AdminPromotionResponse;
  categories: CategoryResponse[];
  canUpdate: boolean;
}

const SHARED_KNOWN_FIELDS = ["displayOrder", "startAt", "endAt"] as const;
const CARD_FIELD_SUFFIXES = [
  "overline",
  "title",
  "subtitle",
  "badgeText",
  "discountPercent",
  "ctaText",
  "ctaLink",
  "imageUrl",
  "targetType",
] as const;

type SharedFieldKey = (typeof SHARED_KNOWN_FIELDS)[number];
type CardFieldSuffix = (typeof CARD_FIELD_SUFFIXES)[number];
type FieldErrors = Partial<Record<SharedFieldKey | CardFieldSuffix | `grid2${Capitalize<CardFieldSuffix>}`, string>>;

function grid2Key(suffix: CardFieldSuffix): `grid2${Capitalize<CardFieldSuffix>}` {
  return (`grid2${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`) as `grid2${Capitalize<CardFieldSuffix>}`;
}

const KNOWN_FIELDS: string[] = [
  ...SHARED_KNOWN_FIELDS,
  ...CARD_FIELD_SUFFIXES,
  ...CARD_FIELD_SUFFIXES.map(grid2Key),
];

/** Backend validation errors arrive either as zod-style {fields:[{path,message}]} or a flat {field:"msg"}. */
function toFieldErrors(details: unknown): FieldErrors {
  const errors: FieldErrors = {};
  if (!details || typeof details !== "object") return errors;
  const record = details as Record<string, unknown>;
  if (Array.isArray(record.fields)) {
    for (const item of record.fields as { path?: string; message?: string }[]) {
      if (item.path && KNOWN_FIELDS.includes(item.path) && item.message) {
        (errors as Record<string, string>)[item.path] = item.message;
      }
    }
  }
  for (const key of KNOWN_FIELDS) {
    if (typeof record[key] === "string") (errors as Record<string, string>)[key] = record[key] as string;
  }
  return errors;
}

/** Slices the shared FieldErrors object down to the suffix-keyed shape PromotionCardFields expects. */
function pickCardErrors(fieldErrors: FieldErrors, prefix: "" | "grid2"): CardFieldErrors {
  const result: CardFieldErrors = {};
  for (const suffix of CARD_FIELD_SUFFIXES) {
    const key = prefix === "" ? suffix : grid2Key(suffix);
    const message = fieldErrors[key];
    if (message) result[suffix] = message;
  }
  return result;
}

/** datetime-local inputs need "YYYY-MM-DDTHH:mm" with no timezone/seconds. */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cardValuesFromPromotion(promotion: AdminPromotionResponse | undefined): PromotionCardValues {
  if (!promotion) return { ...EMPTY_PROMOTION_CARD_VALUES, ctaText: "Shop Now" };
  return {
    overline: promotion.overline ?? "",
    title: promotion.title,
    subtitle: promotion.subtitle ?? "",
    badgeText: promotion.badgeText ?? "",
    discountPercent: promotion.discountPercent !== null ? String(promotion.discountPercent) : "",
    ctaText: promotion.ctaText,
    ctaLink: promotion.ctaLink ?? "",
    imageUrl: promotion.imageUrl ?? "",
    targetType: promotion.targetType ?? "",
    targetProductId: promotion.targetProductId ?? "",
    targetProductLabel: promotion.targetProductName ?? "",
    targetCategoryId: promotion.targetCategoryId ?? "",
  };
}

function grid2ValuesFromPromotion(promotion: AdminPromotionResponse | undefined): PromotionCardValues {
  if (!promotion) return EMPTY_PROMOTION_CARD_VALUES;
  return {
    overline: promotion.grid2Overline ?? "",
    title: promotion.grid2Title ?? "",
    subtitle: promotion.grid2Subtitle ?? "",
    badgeText: promotion.grid2BadgeText ?? "",
    discountPercent: promotion.grid2DiscountPercent !== null ? String(promotion.grid2DiscountPercent) : "",
    ctaText: promotion.grid2CtaText ?? "",
    ctaLink: promotion.grid2CtaLink ?? "",
    imageUrl: promotion.grid2ImageUrl ?? "",
    targetType: promotion.grid2TargetType ?? "",
    targetProductId: promotion.grid2TargetProductId ?? "",
    targetProductLabel: promotion.grid2TargetProductName ?? "",
    targetCategoryId: promotion.grid2TargetCategoryId ?? "",
  };
}

/** Validates & normalizes one card's "0-100 or blank" discount field. Returns null and sets a field error on failure. */
function parseDiscountPercent(raw: string): number | undefined | typeof INVALID {
  if (!raw.trim()) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 100) return INVALID;
  return value;
}
const INVALID = Symbol("invalid-discount");

/** Builds the API payload slice for one card, given its prefix ("" for grid1, "grid2" for grid2). */
function cardToPayload(values: PromotionCardValues) {
  return {
    overline: values.overline.trim() || undefined,
    title: values.title.trim() || undefined,
    subtitle: values.subtitle.trim() || undefined,
    badgeText: values.badgeText.trim() || undefined,
    ctaText: values.ctaText.trim() || undefined,
    ctaLink: values.ctaLink.trim() || undefined,
    imageUrl: values.imageUrl.trim() || undefined,
    targetType: values.targetType || undefined,
    targetProductId: values.targetType === "PRODUCT" ? values.targetProductId || undefined : undefined,
    targetCategoryId: values.targetType === "CATEGORY" ? values.targetCategoryId || undefined : undefined,
  };
}

export function PromotionForm({ mode, promotion, categories, canUpdate }: PromotionFormProps) {
  const router = useRouter();

  const [grid1, setGrid1] = useState<PromotionCardValues>(() => cardValuesFromPromotion(promotion));
  const [grid2, setGrid2] = useState<PromotionCardValues>(() => grid2ValuesFromPromotion(promotion));
  const [displayLayout, setDisplayLayout] = useState<PromotionDisplayLayout>(promotion?.displayLayout ?? "SINGLE");
  const [displayOrder, setDisplayOrder] = useState(String(promotion?.displayOrder ?? 0));
  const [isDraft, setIsDraft] = useState(promotion?.isDraft ?? true);
  const [startAt, setStartAt] = useState(toDatetimeLocalValue(promotion?.startAt));
  const [endAt, setEndAt] = useState(toDatetimeLocalValue(promotion?.endAt));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  function patchGrid1(patch: Partial<PromotionCardValues>) {
    setGrid1((current) => ({ ...current, ...patch }));
  }
  function patchGrid2(patch: Partial<PromotionCardValues>) {
    setGrid2((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(false);

    const discountPercent = parseDiscountPercent(grid1.discountPercent);
    if (discountPercent === INVALID) {
      setFieldErrors({ discountPercent: "Discount percent must be a whole number between 0 and 100." });
      return;
    }
    const grid2DiscountPercent = parseDiscountPercent(grid2.discountPercent);
    if (grid2DiscountPercent === INVALID) {
      setFieldErrors({ grid2DiscountPercent: "Discount percent must be a whole number between 0 and 100." });
      return;
    }
    const orderNumber = Number(displayOrder);
    if (!Number.isInteger(orderNumber) || orderNumber < 0) {
      setFieldErrors({ displayOrder: "Display order must be a whole number, 0 or more." });
      return;
    }

    const grid1Payload = cardToPayload(grid1);
    const grid2Payload = cardToPayload(grid2);

    const basePayload = {
      ...grid1Payload,
      title: grid1.title, // required on create — never undefined
      discountPercent,
      grid2Overline: grid2Payload.overline,
      grid2Title: grid2Payload.title,
      grid2Subtitle: grid2Payload.subtitle,
      grid2BadgeText: grid2Payload.badgeText,
      grid2DiscountPercent,
      grid2CtaText: grid2Payload.ctaText,
      grid2CtaLink: grid2Payload.ctaLink,
      grid2ImageUrl: grid2Payload.imageUrl,
      grid2TargetType: grid2Payload.targetType,
      grid2TargetProductId: grid2Payload.targetProductId,
      grid2TargetCategoryId: grid2Payload.targetCategoryId,
      displayLayout,
      displayOrder: orderNumber,
      isDraft,
      startAt: startAt ? new Date(startAt).toISOString() : undefined,
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
    } satisfies CreatePromotionInput;

    setIsSubmitting(true);
    try {
      if (mode === "edit" && promotion) {
        await updatePromotion(promotion.id, {
          ...basePayload,
          subtitle: basePayload.subtitle ?? null,
          badgeText: basePayload.badgeText ?? null,
          discountPercent: basePayload.discountPercent ?? null,
          ctaLink: basePayload.ctaLink ?? null,
          imageUrl: basePayload.imageUrl ?? null,
          overline: basePayload.overline ?? null,
          targetType: grid1.targetType || null,
          targetProductId: grid1.targetType === "PRODUCT" ? grid1.targetProductId || null : null,
          targetCategoryId: grid1.targetType === "CATEGORY" ? grid1.targetCategoryId || null : null,
          grid2Overline: basePayload.grid2Overline ?? null,
          grid2Title: basePayload.grid2Title ?? null,
          grid2Subtitle: basePayload.grid2Subtitle ?? null,
          grid2BadgeText: basePayload.grid2BadgeText ?? null,
          grid2DiscountPercent: basePayload.grid2DiscountPercent ?? null,
          grid2CtaText: basePayload.grid2CtaText ?? null,
          grid2CtaLink: basePayload.grid2CtaLink ?? null,
          grid2ImageUrl: basePayload.grid2ImageUrl ?? null,
          grid2TargetType: grid2.targetType || null,
          grid2TargetProductId: grid2.targetType === "PRODUCT" ? grid2.targetProductId || null : null,
          grid2TargetCategoryId: grid2.targetType === "CATEGORY" ? grid2.targetCategoryId || null : null,
          startAt: startAt ? new Date(startAt).toISOString() : null,
          endAt: endAt ? new Date(endAt).toISOString() : null,
        });
        setSaved(true);
        router.refresh();
        return;
      }

      const created = await createPromotion(basePayload);
      router.push(`/admin/promotions/${created.id}`);
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

  function previewCard(values: PromotionCardValues) {
    const badge =
      values.badgeText.trim() || (values.discountPercent.trim() ? `${values.discountPercent}% OFF` : null);
    return {
      overline: values.overline.trim() || null,
      title: values.title.trim() || "Promotion title",
      subtitle: values.subtitle.trim() || null,
      badge,
      ctaText: values.ctaText.trim() || "Shop Now",
      ctaLink: values.ctaLink.trim() || "#",
      imageUrl: values.imageUrl.trim() || null,
    };
  }

  const grid2Configured = grid2.title.trim().length > 0 || grid2.imageUrl.trim().length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(320px,420px)]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error ? (
          <p role="alert" className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            Promotion saved.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Display layout" htmlFor="promo-layout">
            <Select
              id="promo-layout"
              value={displayLayout}
              onChange={(event) => setDisplayLayout(event.target.value as PromotionDisplayLayout)}
              disabled={!canUpdate}
              options={[
                { label: "Single (full-width banner)", value: "SINGLE" },
                { label: "Grid (two cards)", value: "GRID" },
              ]}
            />
          </FormField>
          <FormField label="Display order" htmlFor="promo-order" error={fieldErrors.displayOrder}>
            <Input
              id="promo-order"
              type="number"
              min={0}
              step={1}
              value={displayOrder}
              onChange={(event) => setDisplayOrder(event.target.value)}
              disabled={!canUpdate}
              invalid={!!fieldErrors.displayOrder}
            />
          </FormField>
        </div>

        {displayLayout === "GRID" ? (
          <p className="text-sm font-semibold text-text">Grid 1</p>
        ) : null}
        <PromotionCardFields
          idPrefix="promo"
          values={grid1}
          onChange={patchGrid1}
          categories={categories}
          canUpdate={canUpdate}
          fieldErrors={pickCardErrors(fieldErrors, "")}
          titleRequired
        />

        {displayLayout === "GRID" ? (
          <>
            <hr className="border-border" />
            <p className="text-sm font-semibold text-text">Grid 2 (optional)</p>
            <PromotionCardFields
              idPrefix="promo-grid2"
              values={grid2}
              onChange={patchGrid2}
              categories={categories}
              canUpdate={canUpdate}
              fieldErrors={pickCardErrors(fieldErrors, "grid2")}
            />
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start date/time" htmlFor="promo-start" error={fieldErrors.startAt}>
            <Input
              id="promo-start"
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              disabled={!canUpdate}
            />
          </FormField>
          <FormField label="End date/time" htmlFor="promo-end" error={fieldErrors.endAt}>
            <Input
              id="promo-end"
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
              disabled={!canUpdate}
            />
          </FormField>
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={isDraft}
            onChange={(event) => setIsDraft(event.target.checked)}
            disabled={!canUpdate}
          />
          Save as Draft (never shown on the homepage, regardless of dates)
        </label>

        {canUpdate ? (
          <div className="flex justify-end">
            <Button type="submit" isLoading={isSubmitting}>
              {mode === "create" ? "Create Promotion" : "Save Changes"}
            </Button>
          </div>
        ) : null}
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text">Live Preview</p>
        <div className="rounded-lg border border-border bg-bg p-3">
          {displayLayout === "SINGLE" ? (
            <PromoBannerSingle {...previewCard(grid1)} />
          ) : (
            <PromoBannerGrid cards={grid2Configured ? [previewCard(grid1), previewCard(grid2)] : [previewCard(grid1)]} />
          )}
        </div>
      </div>
    </div>
  );
}
