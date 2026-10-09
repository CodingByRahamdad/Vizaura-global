"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useCartWishlist } from "@/context/CartWishlistContext";
import { useMarket } from "@/context/MarketContext";
import { getShippingMethods } from "@/lib/api/shipping";
import { submitCheckout } from "@/lib/api/checkout";
import { getMyAddresses } from "@/lib/api/addresses";
import type { AddressView } from "@/lib/types/addresses";
import { ApiError } from "@/lib/api";
import { CHECKOUT_ERROR_MESSAGES } from "@/lib/types/checkout";
import type { ShippingAddressInput } from "@/lib/types/checkout";
import { PAYMENT_STATUS_DESCRIPTIONS } from "@/lib/types/orders";
import type { ShippingMethodView } from "@/lib/types/shipping";

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(
    amount / 100
  );
}

const EMPTY_ADDRESS: ShippingAddressInput = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "",
};

function toShippingAddressInput(address: AddressView): ShippingAddressInput {
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    region: address.region ?? "",
    postalCode: address.postalCode ?? "",
    countryCode: address.countryCode,
  };
}

function addressesDiffer(a: ShippingAddressInput, b: ShippingAddressInput): boolean {
  return (
    a.fullName !== b.fullName ||
    a.phone !== b.phone ||
    a.line1 !== b.line1 ||
    (a.line2 ?? "") !== (b.line2 ?? "") ||
    a.city !== b.city ||
    (a.region ?? "") !== (b.region ?? "") ||
    (a.postalCode ?? "") !== (b.postalCode ?? "") ||
    a.countryCode !== b.countryCode
  );
}

function checkoutErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return CHECKOUT_ERROR_MESSAGES[error.code ?? ""] ?? error.message;
  }
  return "Something went wrong placing your order. Please try again.";
}

export function CheckoutView() {
  const router = useRouter();
  const { status, user } = useAuth();
  const { cart, isCartLoading, cartError, refreshCart } = useCartWishlist();
  const { marketCode } = useMarket();

  const [billingAddress, setBillingAddress] = useState<ShippingAddressInput>(EMPTY_ADDRESS);
  const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddressInput>(EMPTY_ADDRESS);
  const [methods, setMethods] = useState<ShippingMethodView[] | null>(null);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        setMethods(null);
        setMethodsError(null);
        return getShippingMethods(marketCode);
      })
      .then((list) => {
        if (cancelled) return;
        setMethods(list);
        const firstActive = list.find((m) => m.isActive);
        setSelectedMethodId(firstActive ? firstActive.id : null);
      })
      .catch(() => {
        if (!cancelled) setMethodsError("Couldn't load shipping methods.");
      });
    return () => {
      cancelled = true;
    };
  }, [marketCode]);

  // Prefill from the customer's saved billing/shipping addresses if any
  // exist — purely a frontend convenience, never blocks checkout rendering
  // on failure (new customers simply keep today's empty-form behavior).
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    getMyAddresses()
      .then(({ billing, shipping }) => {
        if (cancelled) return;
        if (billing) {
          const billingInput = toShippingAddressInput(billing);
          setBillingAddress(billingInput);
          if (shipping) {
            const shippingInput = toShippingAddressInput(shipping);
            if (addressesDiffer(billingInput, shippingInput)) {
              setShippingAddress(shippingInput);
              setShipToDifferentAddress(true);
            }
          }
        }
      })
      .catch(() => {
        // Silent — fall back to the empty form, same as a new customer.
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "unauthenticated") {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-8 w-8" aria-hidden />}
        title="Sign in to check out"
        description="Your order is tied to your account. Sign in to continue."
        action={<Button href="/login?redirect=%2Fcheckout">Sign In</Button>}
      />
    );
  }

  if (isCartLoading && !cart) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (cartError && !cart) {
    return <ErrorState message={cartError} onRetry={() => void refreshCart()} />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-8 w-8" aria-hidden />}
        title="Your cart is empty"
        description="Add something to your cart before checking out."
        action={<Button href="/products">Browse Products</Button>}
      />
    );
  }

  const hasUnavailableItems = cart.items.some((item) => !item.isAvailable || !item.isInStock);

  const selectedMethod = methods?.find((m) => m.id === selectedMethodId) ?? null;
  const estimatedShipping = selectedMethod
    ? selectedMethod.freeShippingThreshold !== null &&
      cart.subtotalAmount >= selectedMethod.freeShippingThreshold
      ? 0
      : selectedMethod.baseRate
    : null;
  const estimatedTotal =
    estimatedShipping !== null ? cart.subtotalAmount + estimatedShipping : null;

  function updateBillingField<K extends keyof ShippingAddressInput>(key: K, value: string) {
    setBillingAddress((prev) => ({ ...prev, [key]: value }));
  }

  function updateShippingField<K extends keyof ShippingAddressInput>(key: K, value: string) {
    setShippingAddress((prev) => ({ ...prev, [key]: value }));
  }

  function validateAddress(address: ShippingAddressInput, label: string): string | null {
    if (!address.fullName.trim()) return `${label}: full name is required.`;
    if (!address.phone.trim()) return `${label}: phone number is required.`;
    if (!address.line1.trim()) return `${label}: address line 1 is required.`;
    if (!address.city.trim()) return `${label}: city is required.`;
    if (address.countryCode.trim().length !== 2) return `${label}: country code must be 2 letters (e.g. PK).`;
    return null;
  }

  function validate(): string | null {
    const billingError = validateAddress(billingAddress, "Billing address");
    if (billingError) return billingError;
    if (shipToDifferentAddress) {
      const shippingError = validateAddress(shippingAddress, "Shipping address");
      if (shippingError) return shippingError;
    }
    if (!selectedMethodId) return "Please choose a shipping method.";
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      function normalizeAddress(address: ShippingAddressInput): ShippingAddressInput {
        return {
          ...address,
          countryCode: address.countryCode.trim().toUpperCase(),
          line2: address.line2?.trim() || undefined,
          region: address.region?.trim() || undefined,
          postalCode: address.postalCode?.trim() || undefined,
        };
      }

      const order = await submitCheckout(
        idempotencyKey,
        {
          billingAddress: normalizeAddress(billingAddress),
          shipToDifferentAddress,
          shippingAddress: shipToDifferentAddress ? normalizeAddress(shippingAddress) : undefined,
          paymentMethod: "COD",
          shippingMethodId: selectedMethodId as string,
        },
        marketCode
      );
      await refreshCart();
      router.push(`/account/orders/${order.id}?placed=1`);
    } catch (error) {
      setSubmitError(checkoutErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  const emailNotVerified = Boolean(user && !user.emailVerified);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        {emailNotVerified ? (
          <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            Please verify your email address before checking out.
          </p>
        ) : null}

        {hasUnavailableItems ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            Some items in your cart are no longer available.{" "}
            <a href="/cart" className="underline">
              Review your cart
            </a>{" "}
            before checking out.
          </p>
        ) : null}

        <Card>
          <h2 className="mb-4 font-serif text-xl font-semibold text-text">Billing Address</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full Name" htmlFor="billingFullName" required className="sm:col-span-2">
              <Input
                id="billingFullName"
                value={billingAddress.fullName}
                onChange={(e) => updateBillingField("fullName", e.target.value)}
              />
            </FormField>
            <FormField label="Phone" htmlFor="billingPhone" required>
              <Input
                id="billingPhone"
                type="tel"
                value={billingAddress.phone}
                onChange={(e) => updateBillingField("phone", e.target.value)}
              />
            </FormField>
            <FormField label="Country Code" htmlFor="billingCountryCode" required>
              <Input
                id="billingCountryCode"
                maxLength={2}
                placeholder="PK"
                value={billingAddress.countryCode}
                onChange={(e) => updateBillingField("countryCode", e.target.value.toUpperCase())}
              />
            </FormField>
            <FormField label="Address Line 1" htmlFor="billingLine1" required className="sm:col-span-2">
              <Input
                id="billingLine1"
                value={billingAddress.line1}
                onChange={(e) => updateBillingField("line1", e.target.value)}
              />
            </FormField>
            <FormField label="Address Line 2" htmlFor="billingLine2" className="sm:col-span-2">
              <Input
                id="billingLine2"
                value={billingAddress.line2}
                onChange={(e) => updateBillingField("line2", e.target.value)}
              />
            </FormField>
            <FormField label="City" htmlFor="billingCity" required>
              <Input
                id="billingCity"
                value={billingAddress.city}
                onChange={(e) => updateBillingField("city", e.target.value)}
              />
            </FormField>
            <FormField label="Region / Province" htmlFor="billingRegion">
              <Input
                id="billingRegion"
                value={billingAddress.region}
                onChange={(e) => updateBillingField("region", e.target.value)}
              />
            </FormField>
            <FormField label="Postal Code" htmlFor="billingPostalCode">
              <Input
                id="billingPostalCode"
                value={billingAddress.postalCode}
                onChange={(e) => updateBillingField("postalCode", e.target.value)}
              />
            </FormField>
          </div>

          <Checkbox
            id="shipToDifferentAddress"
            label="Ship to a different address"
            checked={shipToDifferentAddress}
            onChange={(e) => setShipToDifferentAddress(e.target.checked)}
            className="mt-4"
          />
        </Card>

        {shipToDifferentAddress ? (
          <Card>
            <h2 className="mb-4 font-serif text-xl font-semibold text-text">Shipping Address</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Full Name" htmlFor="shippingFullName" required className="sm:col-span-2">
                <Input
                  id="shippingFullName"
                  value={shippingAddress.fullName}
                  onChange={(e) => updateShippingField("fullName", e.target.value)}
                />
              </FormField>
              <FormField label="Phone" htmlFor="shippingPhone" required>
                <Input
                  id="shippingPhone"
                  type="tel"
                  value={shippingAddress.phone}
                  onChange={(e) => updateShippingField("phone", e.target.value)}
                />
              </FormField>
              <FormField label="Country Code" htmlFor="shippingCountryCode" required>
                <Input
                  id="shippingCountryCode"
                  maxLength={2}
                  placeholder="PK"
                  value={shippingAddress.countryCode}
                  onChange={(e) => updateShippingField("countryCode", e.target.value.toUpperCase())}
                />
              </FormField>
              <FormField label="Address Line 1" htmlFor="shippingLine1" required className="sm:col-span-2">
                <Input
                  id="shippingLine1"
                  value={shippingAddress.line1}
                  onChange={(e) => updateShippingField("line1", e.target.value)}
                />
              </FormField>
              <FormField label="Address Line 2" htmlFor="shippingLine2" className="sm:col-span-2">
                <Input
                  id="shippingLine2"
                  value={shippingAddress.line2}
                  onChange={(e) => updateShippingField("line2", e.target.value)}
                />
              </FormField>
              <FormField label="City" htmlFor="shippingCity" required>
                <Input
                  id="shippingCity"
                  value={shippingAddress.city}
                  onChange={(e) => updateShippingField("city", e.target.value)}
                />
              </FormField>
              <FormField label="Region / Province" htmlFor="shippingRegion">
                <Input
                  id="shippingRegion"
                  value={shippingAddress.region}
                  onChange={(e) => updateShippingField("region", e.target.value)}
                />
              </FormField>
              <FormField label="Postal Code" htmlFor="shippingPostalCode">
                <Input
                  id="shippingPostalCode"
                  value={shippingAddress.postalCode}
                  onChange={(e) => updateShippingField("postalCode", e.target.value)}
                />
              </FormField>
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 className="mb-4 font-serif text-xl font-semibold text-text">Shipping Method</h2>
          {methodsError ? (
            <ErrorState message={methodsError} />
          ) : !methods ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : methods.length === 0 ? (
            <p className="text-sm text-text-secondary">No shipping methods are available right now.</p>
          ) : (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Shipping method">
              {methods
                .filter((m) => m.isActive)
                .map((method) => (
                  <label
                    key={method.id}
                    className={`flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 text-sm transition-colors ${
                      selectedMethodId === method.id
                        ? "border-primary bg-primary-light/30"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={selectedMethodId === method.id}
                        onChange={() => setSelectedMethodId(method.id)}
                      />
                      <span>
                        <span className="block font-medium text-text">{method.name}</span>
                        {method.estimatedMinDays !== null ? (
                          <span className="block text-xs text-text-secondary">
                            {method.estimatedMinDays}
                            {method.estimatedMaxDays ? `–${method.estimatedMaxDays}` : ""} business days
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="font-medium text-text">
                      {method.freeShippingThreshold !== null &&
                      cart.subtotalAmount >= method.freeShippingThreshold
                        ? "Free"
                        : formatPrice(method.baseRate, cart.currencyCode)}
                    </span>
                  </label>
                ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-serif text-xl font-semibold text-text">Payment Method</h2>
          <div className="rounded-md border border-border bg-primary-light/20 px-4 py-3 text-sm text-text">
            <p className="font-medium">Cash on Delivery</p>
            <p className="mt-1 text-text-secondary">{PAYMENT_STATUS_DESCRIPTIONS.PENDING}</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-4 font-serif text-xl font-semibold text-text">Order Summary</h2>
          <div className="flex flex-col gap-2 text-sm">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3">
                <span className="text-text-secondary">
                  {item.title} × {item.quantity}
                </span>
                <span className="text-text">
                  {item.lineTotal !== null ? formatPrice(item.lineTotal, cart.currencyCode) : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Subtotal (estimated)</span>
              <span className="text-text">{formatPrice(cart.subtotalAmount, cart.currencyCode)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Shipping (estimated)</span>
              <span className="text-text">
                {estimatedShipping !== null ? formatPrice(estimatedShipping, cart.currencyCode) : "—"}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span className="text-text">Estimated Total</span>
              <span className="text-text">
                {estimatedTotal !== null ? formatPrice(estimatedTotal, cart.currencyCode) : "—"}
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Final totals are calculated at checkout and may differ slightly.
            </p>
          </div>

          {formError ? (
            <p role="alert" className="mt-3 text-sm text-error">
              {formError}
            </p>
          ) : null}
          {submitError ? (
            <p role="alert" className="mt-3 text-sm text-error">
              {submitError}
              {submitError.toLowerCase().includes("cart") ||
              submitError.toLowerCase().includes("item") ||
              submitError.toLowerCase().includes("stock") ? (
                <>
                  {" "}
                  <a href="/cart" className="underline">
                    Review your cart
                  </a>
                </>
              ) : null}
            </p>
          ) : null}

          <Button
            className="mt-4 w-full"
            disabled={isSubmitting || hasUnavailableItems}
            isLoading={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            Place Order
          </Button>
        </Card>
      </div>
    </div>
  );
}
