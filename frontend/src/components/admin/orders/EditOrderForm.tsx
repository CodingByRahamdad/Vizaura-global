"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { ApiError } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { searchAdminInventory } from "@/lib/api/admin/inventory";
import { editAdminOrder, type AdminAddressInput, type EditAdminOrderLineInput } from "@/lib/api/admin/orders";
import type { AdminOrderDetail } from "@/lib/types/admin-orders";
import type { AdminInventoryListResponse } from "@/lib/types/admin-catalog";

interface EditOrderFormProps {
  order: AdminOrderDetail;
}

interface ExistingLineDraft {
  id: string;
  label: string;
  quantity: string;
  unitAmount: string;
  currencyCode: string;
  remove: boolean;
}

interface NewLineDraft {
  key: string;
  productId: string | null;
  variantId: string | null;
  label: string;
  quantity: string;
  priceOverride: string;
}

function emptyNewLine(): NewLineDraft {
  return { key: crypto.randomUUID(), productId: null, variantId: null, label: "", quantity: "1", priceOverride: "" };
}

function toAddressState(address: AdminOrderDetail["billingAddress"]): AdminAddressInput {
  return {
    fullName: address?.fullName ?? "",
    phone: address?.phone ?? "",
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    city: address?.city ?? "",
    region: address?.region ?? "",
    postalCode: address?.postalCode ?? "",
    countryCode: address?.countryCode ?? "",
  };
}

/**
 * Only reachable while the order is still fully mutable (see
 * OrderAdminActions — the detail page hides/disables the Edit entry point
 * once anything real has happened). Address edits and line-item edits
 * (quantity/price on existing lines, add, remove) are all submitted
 * together in one PATCH.
 */
export function EditOrderForm({ order }: EditOrderFormProps) {
  const router = useRouter();
  const [billing, setBilling] = useState<AdminAddressInput>(toAddressState(order.billingAddress));
  const [shipping, setShipping] = useState<AdminAddressInput>(toAddressState(order.shippingAddress));
  const [existingLines, setExistingLines] = useState<ExistingLineDraft[]>(
    order.items.map((item) => ({
      id: item.id,
      label: `${item.productName}${item.variantName ? ` — ${item.variantName}` : ""} (${item.sku})`,
      quantity: String(item.quantity),
      unitAmount: (item.unitAmount / 100).toFixed(2),
      currencyCode: item.currencyCode,
      remove: false,
    })),
  );
  const [newLines, setNewLines] = useState<NewLineDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateBilling<K extends keyof AdminAddressInput>(key: K, value: string) {
    setBilling((prev) => ({ ...prev, [key]: value }));
  }
  function updateShipping<K extends keyof AdminAddressInput>(key: K, value: string) {
    setShipping((prev) => ({ ...prev, [key]: value }));
  }
  function updateExistingLine(id: string, patch: Partial<ExistingLineDraft>) {
    setExistingLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }
  function updateNewLine(key: string, patch: Partial<NewLineDraft>) {
    setNewLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function handleSubmit() {
    setError(null);

    const items: EditAdminOrderLineInput[] = [];
    for (const line of existingLines) {
      if (line.remove) {
        items.push({ id: line.id, remove: true });
        continue;
      }
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setError("Each remaining line needs a valid quantity.");
        return;
      }
      const unitAmountOverride = Math.round(Number(line.unitAmount) * 100);
      if (!Number.isFinite(unitAmountOverride) || unitAmountOverride < 0) {
        setError("Each remaining line needs a valid price.");
        return;
      }
      items.push({ id: line.id, quantity, unitAmountOverride });
    }
    for (const line of newLines) {
      if (!line.productId || !line.variantId) continue;
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setError("Each new line needs a valid quantity.");
        return;
      }
      const override = line.priceOverride.trim() ? Math.round(Number(line.priceOverride.trim()) * 100) : undefined;
      items.push({
        productId: line.productId,
        variantId: line.variantId,
        quantity,
        ...(override !== undefined ? { unitAmountOverride: override } : {}),
      });
    }

    setIsSubmitting(true);
    try {
      await editAdminOrder(order.id, { billingAddress: billing, shippingAddress: shipping, items });
      router.push(`/admin/orders/${order.id}`);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminFormSection title="Billing address">
        <AddressFields value={billing} onChange={updateBilling} prefix="edit-billing" />
      </AdminFormSection>

      <AdminFormSection title="Shipping address">
        <AddressFields value={shipping} onChange={updateShipping} prefix="edit-shipping" />
      </AdminFormSection>

      <AdminFormSection title="Order lines" description="Remove a line, change its quantity/price, or add a new one.">
        <div className="flex flex-col gap-3">
          {existingLines.map((line) => (
            <div key={line.id} className={`rounded-md border p-3 ${line.remove ? "border-error/40 bg-error/5" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm">{line.label}</span>
                <button
                  type="button"
                  className={line.remove ? "text-xs text-text-secondary underline" : "text-xs text-error underline"}
                  onClick={() => updateExistingLine(line.id, { remove: !line.remove })}
                >
                  {line.remove ? "Undo remove" : "Remove"}
                </button>
              </div>
              {!line.remove ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <FormField label="Quantity" htmlFor={`edit-qty-${line.id}`} required>
                    <Input
                      id={`edit-qty-${line.id}`}
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateExistingLine(line.id, { quantity: e.target.value })}
                    />
                  </FormField>
                  <FormField label={`Price (${line.currencyCode})`} htmlFor={`edit-price-${line.id}`} required>
                    <Input
                      id={`edit-price-${line.id}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unitAmount}
                      onChange={(e) => updateExistingLine(line.id, { unitAmount: e.target.value })}
                    />
                  </FormField>
                </div>
              ) : null}
            </div>
          ))}

          {newLines.map((line) => (
            <NewLineRow
              key={line.key}
              line={line}
              marketCode={order.marketCode}
              onSelectProduct={(row) =>
                updateNewLine(line.key, {
                  productId: row.productId,
                  variantId: row.variantId,
                  label: `${row.productName} — ${row.variantTitle} (${row.sku})`,
                })
              }
              onClearProduct={() => updateNewLine(line.key, { productId: null, variantId: null, label: "" })}
              onQuantityChange={(quantity) => updateNewLine(line.key, { quantity })}
              onPriceOverrideChange={(priceOverride) => updateNewLine(line.key, { priceOverride })}
              onRemove={() => setNewLines((current) => current.filter((l) => l.key !== line.key))}
            />
          ))}

          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setNewLines((current) => [...current, emptyNewLine()])}>
            <Plus className="h-4 w-4" aria-hidden />
            Add line
          </Button>
        </div>
      </AdminFormSection>

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(`/admin/orders/${order.id}`)} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="button" isLoading={isSubmitting} onClick={() => void handleSubmit()}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

interface AddressFieldsProps {
  value: AdminAddressInput;
  onChange: <K extends keyof AdminAddressInput>(key: K, value: string) => void;
  prefix: string;
}

function AddressFields({ value, onChange, prefix }: AddressFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Full name" htmlFor={`${prefix}-fullname`} required>
        <Input id={`${prefix}-fullname`} value={value.fullName} onChange={(e) => onChange("fullName", e.target.value)} maxLength={150} />
      </FormField>
      <FormField label="Phone" htmlFor={`${prefix}-phone`} required>
        <Input id={`${prefix}-phone`} value={value.phone} onChange={(e) => onChange("phone", e.target.value)} maxLength={32} />
      </FormField>
      <FormField label="Address line 1" htmlFor={`${prefix}-line1`} required>
        <Input id={`${prefix}-line1`} value={value.line1} onChange={(e) => onChange("line1", e.target.value)} maxLength={255} />
      </FormField>
      <FormField label="Address line 2" htmlFor={`${prefix}-line2`}>
        <Input id={`${prefix}-line2`} value={value.line2 ?? ""} onChange={(e) => onChange("line2", e.target.value)} maxLength={255} />
      </FormField>
      <FormField label="City" htmlFor={`${prefix}-city`} required>
        <Input id={`${prefix}-city`} value={value.city} onChange={(e) => onChange("city", e.target.value)} maxLength={100} />
      </FormField>
      <FormField label="Region/State" htmlFor={`${prefix}-region`}>
        <Input id={`${prefix}-region`} value={value.region ?? ""} onChange={(e) => onChange("region", e.target.value)} maxLength={100} />
      </FormField>
      <FormField label="Postal code" htmlFor={`${prefix}-postal`}>
        <Input id={`${prefix}-postal`} value={value.postalCode ?? ""} onChange={(e) => onChange("postalCode", e.target.value)} maxLength={20} />
      </FormField>
      <FormField label="Country code (2 letters)" htmlFor={`${prefix}-country`} required>
        <Input
          id={`${prefix}-country`}
          value={value.countryCode}
          onChange={(e) => onChange("countryCode", e.target.value.toUpperCase())}
          maxLength={2}
        />
      </FormField>
    </div>
  );
}

interface NewLineRowProps {
  line: NewLineDraft;
  marketCode: string;
  onSelectProduct: (row: AdminInventoryListResponse) => void;
  onClearProduct: () => void;
  onQuantityChange: (value: string) => void;
  onPriceOverrideChange: (value: string) => void;
  onRemove: () => void;
}

function NewLineRow({ line, marketCode, onSelectProduct, onClearProduct, onQuantityChange, onPriceOverrideChange, onRemove }: NewLineRowProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminInventoryListResponse[]>([]);
  const debouncedQuery = useDebouncedValue(query, 400);

  useEffect(() => {
    if (!debouncedQuery.trim() || line.productId) return;
    let cancelled = false;
    searchAdminInventory(debouncedQuery, marketCode)
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, marketCode]);

  const visibleResults = !debouncedQuery.trim() || line.productId ? [] : results;

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="relative flex-1">
          {line.productId ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-bg p-2 text-sm">
              <span>{line.label}</span>
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => {
                  setQuery("");
                  onClearProduct();
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <Input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product by name or SKU..." />
              {visibleResults.length > 0 ? (
                <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
                  {visibleResults.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-bg"
                        onClick={() => {
                          setQuery("");
                          onSelectProduct(row);
                        }}
                      >
                        {row.productName} — {row.variantTitle} ({row.sku}) · {row.available} available
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
        <button type="button" className="text-text-secondary hover:text-error" onClick={onRemove} aria-label="Remove new line">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FormField label="Quantity" htmlFor={`new-qty-${line.key}`} required>
          <Input id={`new-qty-${line.key}`} type="number" min={1} value={line.quantity} onChange={(e) => onQuantityChange(e.target.value)} />
        </FormField>
        <FormField label="Price override" htmlFor={`new-price-${line.key}`}>
          <Input
            id={`new-price-${line.key}`}
            type="number"
            min={0}
            step="0.01"
            value={line.priceOverride}
            onChange={(e) => onPriceOverrideChange(e.target.value)}
            placeholder="Leave blank to use catalog price"
          />
        </FormField>
      </div>
    </div>
  );
}
