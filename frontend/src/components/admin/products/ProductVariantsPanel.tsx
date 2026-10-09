"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api";
import { addOptionValue, createOption, createVariant, deleteOptionValue, deleteVariant, updateVariant } from "@/lib/api/admin/products";
import { upsertPrice } from "@/lib/api/admin/pricing";
import { adjustStock, createStock } from "@/lib/api/admin/inventory";
import { formatPrice } from "@/lib/api/catalog";
import { revalidateProductPage } from "@/lib/actions/revalidateProduct";
import { MARKET_CODES, MARKETS, type MarketCode } from "@/lib/constants/market";
import type { ProductOption, ProductVariant } from "@/lib/types/catalog";
import type { AdminPriceResponse, AdminStockResponse } from "@/lib/types/admin-catalog";

interface ProductVariantsPanelProps {
  productId: string;
  productSlug: string;
  variants: ProductVariant[];
  options: ProductOption[];
  pricesByVariantId: Record<string, AdminPriceResponse[]>;
  stocksByVariantId: Record<string, AdminStockResponse[]>;
  canUpdate: boolean;
}

/**
 * Price is per (variant, market) — never flattened to a single product-level
 * price, matching the backend's VariantPrice model. Stock quantity can be
 * set here per market ("Set stock"), which initializes the stock row
 * (createStock) if none exists yet, or applies a computed delta via the
 * existing audited adjustStock endpoint otherwise — the same endpoint the
 * separate /admin/inventory module's StockAdjustDialog already uses.
 */
export function ProductVariantsPanel({
  productId,
  productSlug,
  variants,
  options,
  pricesByVariantId,
  stocksByVariantId,
  canUpdate,
}: ProductVariantsPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newSku, setNewSku] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newPrices, setNewPrices] = useState<Record<MarketCode, string>>(() => {
    const initial = {} as Record<MarketCode, string>;
    for (const code of MARKET_CODES) initial[code] = "";
    return initial;
  });
  const [newStocks, setNewStocks] = useState<Record<MarketCode, string>>(() => {
    const initial = {} as Record<MarketCode, string>;
    for (const code of MARKET_CODES) initial[code] = "";
    return initial;
  });
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Variants are keyed on a single, always-present "Size" attribute —
   * resolved against the existing generic ProductOption/ProductOptionValue
   * system (unchanged backend) rather than a dedicated field, so existing
   * products/variants and the storefront's generic options rendering both
   * keep working untouched. The admin never sees "option name" or a values
   * list — just this one Size input.
   */
  async function resolveSizeValueId(size: string): Promise<string> {
    const sizeOption = options.find((option) => option.name.toLowerCase() === "size");

    if (!sizeOption) {
      const created = await createOption(productId, { name: "Size", values: [size] });
      const value = created.values.find((v) => v.value === size);
      if (!value) throw new Error("Couldn't create the Size option.");
      return value.id;
    }

    const existing = sizeOption.values.find((value) => value.value.toLowerCase() === size.toLowerCase());
    if (existing) return existing.id;

    const created = await addOptionValue(productId, sizeOption.id, { value: size });
    return created.id;
  }

  async function handleCreateVariant() {
    setIsCreating(true);
    setError(null);
    try {
      const sizeValueId = await resolveSizeValueId(newSize.trim());
      const isFirstVariant = variants.length === 0;
      const created = await createVariant(productId, {
        sku: newSku,
        title: newSize.trim(),
        optionValueIds: [sizeValueId],
        isDefault: isFirstVariant,
      });

      await Promise.all(
        MARKET_CODES.map(async (code) => {
          const priceRaw = newPrices[code].trim();
          const stockRaw = newStocks[code].trim();
          if (priceRaw) {
            const amount = Math.round(Number(priceRaw) * 100);
            if (Number.isFinite(amount) && amount >= 0) {
              await upsertPrice(productId, created.id, code, { currencyCode: MARKETS[code].currencyCode, amount });
            }
          }
          if (stockRaw) {
            const onHand = Math.round(Number(stockRaw));
            if (Number.isFinite(onHand) && onHand >= 0) {
              await createStock(productId, created.id, { marketCode: code, onHand });
            }
          }
        })
      );

      setNewSku("");
      setNewSize("");
      setNewPrices((current) => {
        const reset = { ...current };
        for (const code of MARKET_CODES) reset[code] = "";
        return reset;
      });
      setNewStocks((current) => {
        const reset = { ...current };
        for (const code of MARKET_CODES) reset[code] = "";
        return reset;
      });

      await revalidateProductPage(productSlug);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : submitError instanceof Error
            ? submitError.message
            : "Couldn't create variant."
      );
    } finally {
      setIsCreating(false);
    }
  }

  /**
   * Hard-deletes the variant (backend: real SQL DELETE, cascades clean up
   * its price/stock/option-value link automatically — see
   * variants.repository.ts), then cleans up its Size value if no other
   * remaining variant still uses it, so a deleted size never lingers in the
   * product's options list. Finally revalidates the storefront page so the
   * change is visible immediately rather than after the normal cache window.
   */
  async function handleDeleteVariant(variantId: string) {
    setError(null);
    try {
      const target = variants.find((v) => v.id === variantId);
      await deleteVariant(productId, variantId);

      const sizeAssignment = target?.optionValues[0];
      if (sizeAssignment) {
        const stillUsed = variants.some(
          (v) => v.id !== variantId && v.optionValues.some((ov) => ov.valueId === sizeAssignment.valueId)
        );
        if (!stillUsed) {
          await deleteOptionValue(productId, sizeAssignment.optionId, sizeAssignment.valueId).catch(() => {
            // Non-fatal — the variant itself is already gone; the orphaned
            // Size value can still be removed later from the product page.
          });
        }
      }

      await revalidateProductPage(productSlug);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't remove variant.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-sm text-error">{error}</p> : null}

      {variants.map((variant) => (
        <VariantRow
          key={variant.id}
          productId={productId}
          productSlug={productSlug}
          variant={variant}
          prices={pricesByVariantId[variant.id] ?? []}
          stocks={stocksByVariantId[variant.id] ?? []}
          canUpdate={canUpdate}
          canDelete={canUpdate && !variant.isDefault && variants.length > 1}
          onDelete={() => handleDeleteVariant(variant.id)}
        />
      ))}

      {canUpdate ? (
        <div className="rounded-md border border-dashed border-border p-3">
          <p className="mb-2 text-sm font-medium text-text">Add variant</p>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <Input placeholder="SKU" value={newSku} onChange={(event) => setNewSku(event.target.value)} className="w-40" />
            <Input placeholder="Size (e.g. 30g)" value={newSize} onChange={(event) => setNewSize(event.target.value)} className="w-48" />
          </div>
          <div className="mb-3 flex flex-wrap gap-4">
            {MARKET_CODES.map((code) => (
              <div key={code} className="flex gap-2">
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">
                    {MARKETS[code].label} price (optional)
                  </label>
                  <Input
                    value={newPrices[code]}
                    onChange={(event) => setNewPrices((current) => ({ ...current, [code]: event.target.value }))}
                    inputMode="decimal"
                    className="w-32"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">
                    {MARKETS[code].label} stock (optional)
                  </label>
                  <Input
                    value={newStocks[code]}
                    onChange={(event) => setNewStocks((current) => ({ ...current, [code]: event.target.value }))}
                    inputMode="numeric"
                    className="w-28"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleCreateVariant}
            isLoading={isCreating}
            disabled={!newSku || !newSize.trim()}
          >
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function toDatetimeLocal(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

function VariantRow({
  productId,
  productSlug,
  variant,
  prices,
  stocks,
  canUpdate,
  canDelete,
  onDelete,
}: {
  productId: string;
  productSlug: string;
  variant: ProductVariant;
  prices: AdminPriceResponse[];
  stocks: AdminStockResponse[];
  canUpdate: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const router = useRouter();
  const priceByMarket = new Map(prices.map((p) => [p.marketCode, p]));
  const stockByMarket = new Map(stocks.map((s) => [s.marketCode, s]));
  const [amounts, setAmounts] = useState<Record<MarketCode, string>>(() => {
    const initial = {} as Record<MarketCode, string>;
    for (const code of MARKET_CODES) {
      const price = priceByMarket.get(code);
      initial[code] = price ? String(price.amount / 100) : "";
    }
    return initial;
  });
  const [saleAmounts, setSaleAmounts] = useState<Record<MarketCode, string>>(() => {
    const initial = {} as Record<MarketCode, string>;
    for (const code of MARKET_CODES) {
      const price = priceByMarket.get(code);
      initial[code] = price?.saleAmount != null ? String(price.saleAmount / 100) : "";
    }
    return initial;
  });
  const [saleStartsAt, setSaleStartsAt] = useState<Record<MarketCode, string>>(() => {
    const initial = {} as Record<MarketCode, string>;
    for (const code of MARKET_CODES) {
      const price = priceByMarket.get(code);
      initial[code] = price?.saleStartsAt ? toDatetimeLocal(price.saleStartsAt) : "";
    }
    return initial;
  });
  const [saleEndsAt, setSaleEndsAt] = useState<Record<MarketCode, string>>(() => {
    const initial = {} as Record<MarketCode, string>;
    for (const code of MARKET_CODES) {
      const price = priceByMarket.get(code);
      initial[code] = price?.saleEndsAt ? toDatetimeLocal(price.saleEndsAt) : "";
    }
    return initial;
  });
  const [stockInputs, setStockInputs] = useState<Record<MarketCode, string>>(() => {
    const initial = {} as Record<MarketCode, string>;
    for (const code of MARKET_CODES) {
      const stock = stockByMarket.get(code);
      initial[code] = stock ? String(stock.onHand) : "";
    }
    return initial;
  });
  const [savingStockMarket, setSavingStockMarket] = useState<MarketCode | null>(null);
  const [savingMarket, setSavingMarket] = useState<MarketCode | null>(null);
  const [status, setStatus] = useState(variant.status);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveStatus() {
    setIsSavingStatus(true);
    setError(null);
    try {
      await updateVariant(productId, variant.id, { status: status as "ACTIVE" | "INACTIVE" | "ARCHIVED" });
      await revalidateProductPage(productSlug);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't update status.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function handleSetStock(code: MarketCode) {
    setSavingStockMarket(code);
    setError(null);
    try {
      const desired = Math.round(Number(stockInputs[code]));
      if (!Number.isFinite(desired) || desired < 0) throw new Error("Enter a valid stock quantity.");

      const current = stockByMarket.get(code);
      if (!current) {
        await createStock(productId, variant.id, { marketCode: code, onHand: desired });
      } else {
        const delta = desired - current.onHand;
        if (delta !== 0) {
          await adjustStock(productId, variant.id, code, { delta, reason: "Admin stock update" });
        }
      }
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : submitError instanceof Error
            ? submitError.message
            : "Couldn't update stock."
      );
    } finally {
      setSavingStockMarket(null);
    }
  }

  async function handleSavePrice(code: MarketCode) {
    setSavingMarket(code);
    setError(null);
    try {
      const amount = Math.round(Number(amounts[code]) * 100);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid amount.");

      const saleAmountRaw = saleAmounts[code].trim();
      const saleAmount = saleAmountRaw ? Math.round(Number(saleAmountRaw) * 100) : null;
      if (saleAmountRaw && (!Number.isFinite(saleAmount) || saleAmount! < 0)) {
        throw new Error("Enter a valid sale amount.");
      }
      if (saleAmount != null && saleAmount >= amount) {
        throw new Error("Sale price must be less than the regular price.");
      }

      await upsertPrice(productId, variant.id, code, {
        currencyCode: MARKETS[code].currencyCode,
        amount,
        saleAmount,
        saleStartsAt: saleStartsAt[code] ? new Date(saleStartsAt[code]).toISOString() : null,
        saleEndsAt: saleEndsAt[code] ? new Date(saleEndsAt[code]).toISOString() : null,
      });
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : submitError instanceof Error
            ? submitError.message
            : "Couldn't save price."
      );
    } finally {
      setSavingMarket(null);
    }
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-text">
            {variant.title} <span className="text-text-secondary">({variant.sku})</span>
            {variant.isDefault ? <span className="ml-2 text-xs text-primary">Default</span> : null}
          </p>
          {canUpdate ? (
            <div className="mt-1 flex items-center gap-2">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              {status !== variant.status ? (
                <Button type="button" size="sm" variant="outline" onClick={handleSaveStatus} isLoading={isSavingStatus}>
                  Save
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-text-secondary">{variant.status}</p>
          )}
        </div>
        {canDelete ? (
          <Button type="button" size="sm" variant="outline" onClick={onDelete}>
            Remove
          </Button>
        ) : null}
      </div>

      {error ? <p className="mb-2 text-sm text-error">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MARKET_CODES.map((code) => {
          const stock = stockByMarket.get(code);
          return (
            <div key={code} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-text-secondary">
                  {MARKETS[code].label} price ({MARKETS[code].currencyCode})
                </label>
                <Input
                  value={amounts[code]}
                  onChange={(event) => setAmounts((current) => ({ ...current, [code]: event.target.value }))}
                  disabled={!canUpdate}
                  inputMode="decimal"
                />
                <label className="mb-1 mt-2 block text-xs text-text-secondary">
                  Sale price ({MARKETS[code].currencyCode}, optional)
                </label>
                <Input
                  value={saleAmounts[code]}
                  onChange={(event) => setSaleAmounts((current) => ({ ...current, [code]: event.target.value }))}
                  disabled={!canUpdate}
                  inputMode="decimal"
                  placeholder="No sale"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">Sale starts</label>
                    <input
                      type="datetime-local"
                      value={saleStartsAt[code]}
                      onChange={(event) => setSaleStartsAt((current) => ({ ...current, [code]: event.target.value }))}
                      disabled={!canUpdate}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">Sale ends</label>
                    <input
                      type="datetime-local"
                      value={saleEndsAt[code]}
                      onChange={(event) => setSaleEndsAt((current) => ({ ...current, [code]: event.target.value }))}
                      disabled={!canUpdate}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {stock ? `${stock.available} available (${stock.onHand} on hand, ${stock.reserved} reserved)` : "No stock record"}
                </p>
                <label className="mb-1 mt-2 block text-xs text-text-secondary">Stock quantity</label>
                <div className="flex gap-2">
                  <Input
                    value={stockInputs[code]}
                    onChange={(event) => setStockInputs((current) => ({ ...current, [code]: event.target.value }))}
                    disabled={!canUpdate}
                    inputMode="numeric"
                    className="flex-1"
                  />
                  {canUpdate ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetStock(code)}
                      isLoading={savingStockMarket === code}
                      disabled={!stockInputs[code]}
                    >
                      Set stock
                    </Button>
                  ) : null}
                </div>
              </div>
              {canUpdate ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => handleSavePrice(code)} isLoading={savingMarket === code}>
                  Save
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      {priceByMarket.size > 0 ? (
        <p className="mt-2 text-xs text-text-secondary">
          {MARKET_CODES.filter((c) => priceByMarket.has(c))
            .map((c) => {
              const price = priceByMarket.get(c)!;
              const base = `${c}: ${formatPrice(price.amount, price.currencyCode)}`;
              if (price.saleAmount == null) return base;
              const until = price.saleEndsAt ? ` until ${new Date(price.saleEndsAt).toLocaleDateString()}` : "";
              return `${base} (on sale: ${formatPrice(price.saleAmount, price.currencyCode)}${until})`;
            })
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
