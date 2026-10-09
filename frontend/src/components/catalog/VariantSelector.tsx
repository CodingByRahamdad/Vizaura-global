"use client";

import { useRouter, usePathname } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useAuth } from "@/context/AuthContext";
import { useCartWishlist } from "@/context/CartWishlistContext";
import { useMarket } from "@/context/MarketContext";
import { getVariantPrice, getVariantStock } from "@/lib/api/catalog";
import type {
  ProductOption,
  ProductVariant,
  PublicPriceResponse,
  PublicStockResponse,
} from "@/lib/types/catalog";

interface VariantSelectorProps {
  productId: string;
  options: ProductOption[];
  variants: ProductVariant[];
  initialVariantId: string;
  initialPrice: PublicPriceResponse | null;
  initialStock: PublicStockResponse | null;
}

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
  }).format(amount / 100);
}

function findVariant(
  variants: ProductVariant[],
  selected: Record<string, string>,
  optionCount: number
): ProductVariant | undefined {
  return variants.find(
    (variant) =>
      variant.optionValues.length === optionCount &&
      variant.optionValues.every((ov) => selected[ov.optionId] === ov.valueId)
  );
}

export function VariantSelector({
  productId,
  options,
  variants,
  initialVariantId,
  initialPrice,
  initialStock,
}: VariantSelectorProps) {
  const initialVariant = variants.find((v) => v.id === initialVariantId);
  const initialSelection: Record<string, string> = {};
  initialVariant?.optionValues.forEach((ov) => {
    initialSelection[ov.optionId] = ov.valueId;
  });

  const [selected, setSelected] = useState<Record<string, string>>(initialSelection);
  const [price, setPrice] = useState<PublicPriceResponse | null>(initialPrice);
  const [stock, setStock] = useState<PublicStockResponse | null>(initialStock);
  const [isPending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(1);
  const [cartActionError, setCartActionError] = useState<string | null>(null);
  const [variantDataError, setVariantDataError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const { addItem, pendingKeys } = useCartWishlist();
  const { marketCode } = useMarket();
  const latestRequestedVariantId = useRef<string | null>(initialVariantId);

  const activeVariant = useMemo(
    () => findVariant(variants, selected, options.length),
    [variants, selected, options.length]
  );

  /// Variants are already filtered to ACTIVE-only by the backend (see
  /// catalog.products.repository.ts), but ProductOptionValue rows (the Size
  /// buttons below) are a separate entity that isn't deleted when a variant
  /// is deactivated — so a button for an inactive-only size could otherwise
  /// still render. Only show a value that at least one active variant uses.
  const activeValueIds = useMemo(
    () => new Set(variants.flatMap((variant) => variant.optionValues.map((ov) => ov.valueId))),
    [variants]
  );

  function handleSelect(optionId: string, valueId: string) {
    const next = { ...selected, [optionId]: valueId };
    setSelected(next);
    setPrice(null);
    setStock(null);
    setVariantDataError(null);

    const variant = findVariant(variants, next, options.length);
    latestRequestedVariantId.current = variant?.id ?? null;
    if (!variant) return;

    startTransition(async () => {
      const [nextPrice, nextStock] = await Promise.allSettled([
        getVariantPrice(productId, variant.id, marketCode),
        getVariantStock(productId, variant.id, marketCode),
      ]);
      // A newer selection may have superseded this request while it was in
      // flight (out-of-order network resolution) — discard a stale response
      // rather than let it overwrite the currently selected variant's data.
      if (latestRequestedVariantId.current !== variant.id) return;
      setPrice(nextPrice.status === "fulfilled" ? nextPrice.value : null);
      setStock(nextStock.status === "fulfilled" ? nextStock.value : null);
      // Surface a genuine fetch failure distinctly from "still loading" or
      // "not on sale" — both of those also render with a null price/stock.
      setVariantDataError(
        nextPrice.status === "rejected" || nextStock.status === "rejected"
          ? "Couldn't load this variant's price/stock. Please retry."
          : null
      );
    });
  }

  const isAvailable = activeVariant && stock?.status === "IN_STOCK";
  const isAddPending = activeVariant ? pendingKeys.has(`add:${activeVariant.id}`) : false;

  async function handleAddToCart(): Promise<boolean> {
    if (!activeVariant) return false;
    if (status !== "authenticated") {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return false;
    }
    setCartActionError(null);
    try {
      await addItem(activeVariant.id, quantity);
      return true;
    } catch {
      setCartActionError("Couldn't add this item to your cart.");
      return false;
    }
  }

  async function handleBuyNow() {
    // No single-item express-checkout endpoint exists on the backend, so
    // Buy Now adds to cart then goes straight to the real checkout page,
    // skipping the cart review step (Phase 5B-3).
    const added = await handleAddToCart();
    if (added) router.push("/checkout");
  }

  const discountPercent =
    price?.isOnSale && price.compareAtAmount
      ? Math.round(((price.compareAtAmount - price.amount) / price.compareAtAmount) * 100)
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl font-semibold text-text">
          {isPending ? "…" : (price ? formatPrice(price.amount, price.currencyCode) : "Price unavailable")}
        </span>
        {price?.isOnSale && price.compareAtAmount ? (
          <span className="text-sm text-text-secondary line-through">
            {formatPrice(price.compareAtAmount, price.currencyCode)}
          </span>
        ) : null}
        {discountPercent ? (
          <span className="rounded-sm bg-error px-2 py-0.5 text-xs font-semibold uppercase text-white">
            {discountPercent}% OFF
          </span>
        ) : null}
      </div>

      {variantDataError ? (
        <p role="alert" className="text-sm text-error">
          {variantDataError}
        </p>
      ) : null}

      {options.map((option) => {
        const availableValues = option.values.filter((value) => activeValueIds.has(value.id));
        if (availableValues.length === 0) return null;
        return (
          <div key={option.id}>
            <p className="mb-2 text-sm font-medium text-text">{option.name}</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={option.name}>
              {availableValues.map((value) => {
                const isSelected = selected[option.id] === value.id;
                return (
                  <button
                    key={value.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelect(option.id, value.id)}
                    className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-text hover:border-primary"
                    }`}
                  >
                    {value.value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {activeVariant && !isAvailable ? (
        <p className="text-sm text-text-secondary">
          {stock ? "Out of Stock" : "Checking availability…"}
        </p>
      ) : !activeVariant ? (
        <p className="text-sm text-error">This combination is not available.</p>
      ) : null}

      {isAvailable ? (
        <div className="flex items-center gap-3">
          <div className="self-start">
            <QuantityStepper
              value={quantity}
              onChange={(next) => setQuantity(Math.max(1, next))}
              max={stock?.lowStockQuantity ?? undefined}
            />
          </div>
          <p className="text-sm text-text-secondary">
            {stock?.lowStockQuantity != null ? `Only ${stock.lowStockQuantity} left in stock` : "In Stock (Ready to Ship)"}
          </p>
        </div>
      ) : null}

      {cartActionError ? (
        <p role="alert" className="text-sm text-error">
          {cartActionError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button
          disabled={!isAvailable || isAddPending}
          isLoading={isAddPending}
          className="flex-1"
          onClick={() => void handleAddToCart()}
        >
          Add to Cart
        </Button>
        <Button
          variant="outline"
          disabled={!isAvailable || isAddPending}
          isLoading={isAddPending}
          className="flex-1"
          onClick={() => void handleBuyNow()}
        >
          Buy Now
        </Button>
      </div>
    </div>
  );
}
