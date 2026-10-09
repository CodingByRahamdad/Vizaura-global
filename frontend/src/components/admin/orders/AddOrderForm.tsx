"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { ApiError } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { MARKET_CODES, MARKETS, type MarketCode } from "@/lib/constants/market";
import { searchAdminCustomers } from "@/lib/api/admin/customers";
import { searchAdminInventory } from "@/lib/api/admin/inventory";
import { getPricesForVariant } from "@/lib/api/admin/pricing";
import { createAdminOrder, type CreateAdminOrderLineInput } from "@/lib/api/admin/orders";
import { formatOrderMoney } from "@/lib/utils/adminOrderFormat";
import type { AdminCustomerSummary } from "@/lib/types/admin-customers";
import type { AdminInventoryListResponse } from "@/lib/types/admin-catalog";

const PAYMENT_METHOD_OPTIONS = [
  { label: "Cash", value: "CASH" },
  { label: "Bank transfer", value: "BANK_TRANSFER" },
  { label: "Other", value: "OTHER" },
];

const PAYMENT_STATUS_OPTIONS = [
  { label: "Pending", value: "PENDING" },
  { label: "Already paid", value: "PAID" },
];

interface LineDraft {
  key: string;
  productId: string | null;
  variantId: string | null;
  label: string;
  quantity: string;
  catalogPrice: number | null;
  currencyCode: string | null;
  priceOverride: string;
}

function emptyLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    productId: null,
    variantId: null,
    label: "",
    quantity: "1",
    catalogPrice: null,
    currencyCode: null,
    priceOverride: "",
  };
}

/**
 * Admin-entered offline order (phone/WhatsApp/walk-in) — mirrors
 * ProductForm's create-mode shape (local state per field, submit -> client
 * API call -> redirect to the created record). Lines must reference real
 * catalog products/variants (searchAdminInventory, scoped to the chosen
 * market), never free text, so inventory/pricing stay accurate; the backend
 * re-validates every line exactly like checkout does.
 */
export function AddOrderForm() {
  const router = useRouter();
  const [market, setMarket] = useState<MarketCode>(MARKET_CODES[0]);
  const [customerMode, setCustomerMode] = useState<"existing" | "guest">("existing");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<AdminCustomerSummary[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomerSummary | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentStatus, setPaymentStatus] = useState<"PENDING" | "PAID">("PENDING");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false);
  const [shipFullName, setShipFullName] = useState("");
  const [shipPhone, setShipPhone] = useState("");
  const [shipLine1, setShipLine1] = useState("");
  const [shipLine2, setShipLine2] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipRegion, setShipRegion] = useState("");
  const [shipPostalCode, setShipPostalCode] = useState("");
  const [shipCountryCode, setShipCountryCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedCustomerQuery = useDebouncedValue(customerQuery, 500);

  useEffect(() => {
    if (!debouncedCustomerQuery.trim() || selectedCustomer) return;
    let cancelled = false;
    searchAdminCustomers(debouncedCustomerQuery)
      .then((results) => {
        if (!cancelled) setCustomerResults(results);
      })
      .catch(() => {
        if (!cancelled) setCustomerResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedCustomerQuery, selectedCustomer]);

  // Hides stale results once the query is cleared or a customer is picked,
  // without clearing them synchronously inside the effect above.
  const visibleCustomerResults = !debouncedCustomerQuery.trim() || selectedCustomer ? [] : customerResults;

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.key !== key) : current));
  }

  async function selectProduct(key: string, row: AdminInventoryListResponse) {
    updateLine(key, {
      productId: row.productId,
      variantId: row.variantId,
      label: `${row.productName} — ${row.variantTitle} (${row.sku})`,
      catalogPrice: null,
      currencyCode: null,
    });
    try {
      const prices = await getPricesForVariant(row.productId, row.variantId);
      const marketPrice = prices.find((p) => p.marketCode === market && p.isActive);
      if (marketPrice) {
        const saleActive =
          marketPrice.saleAmount !== null &&
          (!marketPrice.saleStartsAt || new Date(marketPrice.saleStartsAt) <= new Date()) &&
          (!marketPrice.saleEndsAt || new Date(marketPrice.saleEndsAt) >= new Date());
        updateLine(key, {
          catalogPrice: saleActive ? marketPrice.saleAmount! : marketPrice.amount,
          currencyCode: marketPrice.currencyCode,
        });
      }
    } catch {
      // No price configured for this market — the admin can still enter an
      // override; the backend rejects the order at submit if neither exists.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (customerMode === "existing" && !selectedCustomer) {
      setError("Select a customer first.");
      return;
    }
    if (customerMode === "guest" && !guestEmail.trim()) {
      setError("Enter the guest's email address.");
      return;
    }
    const resolvedLines: CreateAdminOrderLineInput[] = [];
    for (const line of lines) {
      if (!line.productId || !line.variantId) continue;
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setError("Each line needs a valid quantity.");
        return;
      }
      const override = line.priceOverride.trim() ? Math.round(Number(line.priceOverride.trim()) * 100) : undefined;
      resolvedLines.push({
        productId: line.productId,
        variantId: line.variantId,
        quantity,
        ...(override !== undefined ? { unitAmountOverride: override } : {}),
      });
    }
    if (resolvedLines.length === 0) {
      setError("Add at least one product line.");
      return;
    }
    if (!fullName.trim() || !phone.trim() || !line1.trim() || !city.trim() || !countryCode.trim()) {
      setError("Fill in the required billing address fields.");
      return;
    }
    if (shipToDifferentAddress && (!shipFullName.trim() || !shipPhone.trim() || !shipLine1.trim() || !shipCity.trim() || !shipCountryCode.trim())) {
      setError("Fill in the required shipping address fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createAdminOrder({
        ...(customerMode === "existing" ? { userId: selectedCustomer!.id } : { guestEmail: guestEmail.trim() }),
        market,
        paymentMethod,
        paymentStatus,
        billingAddress: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          region: region.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          countryCode: countryCode.trim().toUpperCase(),
        },
        shipToDifferentAddress,
        ...(shipToDifferentAddress
          ? {
              shippingAddress: {
                fullName: shipFullName.trim(),
                phone: shipPhone.trim(),
                line1: shipLine1.trim(),
                line2: shipLine2.trim() || undefined,
                city: shipCity.trim(),
                region: shipRegion.trim() || undefined,
                postalCode: shipPostalCode.trim() || undefined,
                countryCode: shipCountryCode.trim().toUpperCase(),
              },
            }
          : {}),
        lines: resolvedLines,
      });
      router.push(`/admin/orders/${created.id}`);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <AdminFormSection
        title="Customer"
        description={
          customerMode === "existing"
            ? "Search for an existing, registered customer to place this order for."
            : "No account needed — the name/phone/address below (Billing address section) and this email identify the customer."
        }
      >
        <div className="mb-4 flex gap-2" role="radiogroup" aria-label="Customer type">
          <Button
            type="button"
            variant={customerMode === "existing" ? "primary" : "outline"}
            size="sm"
            onClick={() => setCustomerMode("existing")}
          >
            Existing customer
          </Button>
          <Button
            type="button"
            variant={customerMode === "guest" ? "primary" : "outline"}
            size="sm"
            onClick={() => {
              setCustomerMode("guest");
              setSelectedCustomer(null);
              setCustomerQuery("");
            }}
          >
            New / guest customer
          </Button>
        </div>

        {customerMode === "guest" ? (
          <FormField label="Email address" htmlFor="order-guest-email" required>
            <Input
              id="order-guest-email"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </FormField>
        ) : (
        <FormField label="Customer" htmlFor="order-customer" required>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-bg p-2 text-sm">
              <span>
                {selectedCustomer.firstName} {selectedCustomer.lastName} · {selectedCustomer.email}
              </span>
              <button
                type="button"
                className="text-text-secondary hover:text-text"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerQuery("");
                }}
                aria-label="Clear selected customer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                id="order-customer"
                type="text"
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                placeholder="Search by name or email..."
              />
              {visibleCustomerResults.length > 0 ? (
                <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
                  {visibleCustomerResults.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-bg"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerResults([]);
                        }}
                      >
                        {customer.firstName} {customer.lastName} · {customer.email}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </FormField>
        )}
      </AdminFormSection>

      <AdminFormSection title="Market">
        <FormField label="Market" htmlFor="order-market" required>
          <Select
            id="order-market"
            value={market}
            onChange={(event) => setMarket(event.target.value as MarketCode)}
            options={MARKET_CODES.map((code) => ({ label: MARKETS[code].label, value: code }))}
          />
        </FormField>
      </AdminFormSection>

      <AdminFormSection
        title="Order lines"
        description="Each line must reference a real catalog product so inventory and pricing stay accurate."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, emptyLine()])}>
            <Plus className="h-4 w-4" aria-hidden />
            Add line
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {lines.map((line) => (
            <OrderLineRow
              key={line.key}
              line={line}
              market={market}
              onSelectProduct={(row) => void selectProduct(line.key, row)}
              onClearProduct={() => updateLine(line.key, { productId: null, variantId: null, label: "", catalogPrice: null, currencyCode: null })}
              onQuantityChange={(quantity) => updateLine(line.key, { quantity })}
              onPriceOverrideChange={(priceOverride) => updateLine(line.key, { priceOverride })}
              onRemove={() => removeLine(line.key)}
              canRemove={lines.length > 1}
            />
          ))}
        </div>
      </AdminFormSection>

      <AdminFormSection title="Payment">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Payment method" htmlFor="order-payment-method" required>
            <Select
              id="order-payment-method"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              options={PAYMENT_METHOD_OPTIONS}
            />
          </FormField>
          <FormField label="Payment status" htmlFor="order-payment-status" required>
            <Select
              id="order-payment-status"
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value as "PENDING" | "PAID")}
              options={PAYMENT_STATUS_OPTIONS}
            />
          </FormField>
        </div>
      </AdminFormSection>

      <AdminFormSection title="Billing address">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="order-fullname" required>
            <Input id="order-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={150} />
          </FormField>
          <FormField label="Phone" htmlFor="order-phone" required>
            <Input id="order-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} />
          </FormField>
          <FormField label="Address line 1" htmlFor="order-line1" required>
            <Input id="order-line1" value={line1} onChange={(e) => setLine1(e.target.value)} maxLength={255} />
          </FormField>
          <FormField label="Address line 2" htmlFor="order-line2">
            <Input id="order-line2" value={line2} onChange={(e) => setLine2(e.target.value)} maxLength={255} />
          </FormField>
          <FormField label="City" htmlFor="order-city" required>
            <Input id="order-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
          </FormField>
          <FormField label="Region/State" htmlFor="order-region">
            <Input id="order-region" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={100} />
          </FormField>
          <FormField label="Postal code" htmlFor="order-postal">
            <Input id="order-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} maxLength={20} />
          </FormField>
          <FormField label="Country code (2 letters)" htmlFor="order-country" required>
            <Input id="order-country" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} maxLength={2} />
          </FormField>
        </div>

        <Checkbox
          id="order-ship-to-different-address"
          label="Ship to a different address"
          checked={shipToDifferentAddress}
          onChange={(e) => setShipToDifferentAddress(e.target.checked)}
          className="mt-4"
        />
      </AdminFormSection>

      {shipToDifferentAddress ? (
        <AdminFormSection title="Shipping address">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="order-ship-fullname" required>
              <Input id="order-ship-fullname" value={shipFullName} onChange={(e) => setShipFullName(e.target.value)} maxLength={150} />
            </FormField>
            <FormField label="Phone" htmlFor="order-ship-phone" required>
              <Input id="order-ship-phone" value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} maxLength={32} />
            </FormField>
            <FormField label="Address line 1" htmlFor="order-ship-line1" required>
              <Input id="order-ship-line1" value={shipLine1} onChange={(e) => setShipLine1(e.target.value)} maxLength={255} />
            </FormField>
            <FormField label="Address line 2" htmlFor="order-ship-line2">
              <Input id="order-ship-line2" value={shipLine2} onChange={(e) => setShipLine2(e.target.value)} maxLength={255} />
            </FormField>
            <FormField label="City" htmlFor="order-ship-city" required>
              <Input id="order-ship-city" value={shipCity} onChange={(e) => setShipCity(e.target.value)} maxLength={100} />
            </FormField>
            <FormField label="Region/State" htmlFor="order-ship-region">
              <Input id="order-ship-region" value={shipRegion} onChange={(e) => setShipRegion(e.target.value)} maxLength={100} />
            </FormField>
            <FormField label="Postal code" htmlFor="order-ship-postal">
              <Input id="order-ship-postal" value={shipPostalCode} onChange={(e) => setShipPostalCode(e.target.value)} maxLength={20} />
            </FormField>
            <FormField label="Country code (2 letters)" htmlFor="order-ship-country" required>
              <Input id="order-ship-country" value={shipCountryCode} onChange={(e) => setShipCountryCode(e.target.value)} maxLength={2} />
            </FormField>
          </div>
        </AdminFormSection>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/orders")} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Create order
        </Button>
      </div>
    </form>
  );
}

interface OrderLineRowProps {
  line: LineDraft;
  market: MarketCode;
  onSelectProduct: (row: AdminInventoryListResponse) => void;
  onClearProduct: () => void;
  onQuantityChange: (value: string) => void;
  onPriceOverrideChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function OrderLineRow({
  line,
  market,
  onSelectProduct,
  onClearProduct,
  onQuantityChange,
  onPriceOverrideChange,
  onRemove,
  canRemove,
}: OrderLineRowProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminInventoryListResponse[]>([]);
  const debouncedQuery = useDebouncedValue(query, 400);

  useEffect(() => {
    if (!debouncedQuery.trim() || line.productId) return;
    let cancelled = false;
    searchAdminInventory(debouncedQuery, market)
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });
    return () => {
      cancelled = true;
    };
    // line.productId intentionally omitted: clearing the selection (via the
    // "Change" button below) resets query to "", which re-triggers this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, market]);

  // Hides stale results once the query is cleared or a product is picked,
  // without clearing them synchronously inside the effect above.
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
              <Input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search product by name or SKU..."
              />
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
        {canRemove ? (
          <button type="button" className="text-text-secondary hover:text-error" onClick={onRemove} aria-label="Remove line">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FormField label="Quantity" htmlFor={`qty-${line.key}`} required>
          <Input
            id={`qty-${line.key}`}
            type="number"
            min={1}
            value={line.quantity}
            onChange={(event) => onQuantityChange(event.target.value)}
          />
        </FormField>
        <FormField
          label={
            line.catalogPrice !== null && line.currencyCode
              ? `Price override (catalog: ${formatOrderMoney(line.catalogPrice, line.currencyCode)})`
              : "Price override"
          }
          htmlFor={`price-${line.key}`}
        >
          <Input
            id={`price-${line.key}`}
            type="number"
            min={0}
            step="0.01"
            value={line.priceOverride}
            onChange={(event) => onPriceOverrideChange(event.target.value)}
            placeholder="Leave blank to use catalog price"
          />
        </FormField>
      </div>
    </div>
  );
}
