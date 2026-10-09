"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShoppingCart, Truck, Headset, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SafeImage } from "@/components/ui/SafeImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useAuth } from "@/context/AuthContext";
import { useCartWishlist } from "@/context/CartWishlistContext";
import { useMarket } from "@/context/MarketContext";
import { getShippingMethods } from "@/lib/api/shipping";
import { formatPrice } from "@/lib/api/catalog";
import type { ShippingMethodView } from "@/lib/types/shipping";
import type { CartItemView } from "@/lib/types/cart";
import { CartRecommendations } from "@/components/cart/CartRecommendations";

function CartItemRow({ item, currencyCode }: { item: CartItemView; currencyCode: string }) {
  const { updateItem, removeItem, pendingKeys } = useCartWishlist();
  const isPending = pendingKeys.has(`item:${item.id}`);

  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex gap-3 sm:flex-1 sm:items-center">
        <Link
          href={`/products/${item.productSlug}`}
          className="h-[90px] w-[90px] shrink-0 overflow-hidden rounded-md bg-primary-light/30"
        >
          <SafeImage src={item.imageUrl} alt={item.productName} className="h-full w-full" />
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={`/products/${item.productSlug}`}
            className="line-clamp-1 font-medium text-text hover:text-primary-dark"
          >
            {item.productName}
          </Link>
          <p className="text-xs text-text-secondary">{item.variantTitle}</p>
          {!item.isAvailable ? (
            <Badge variant="error" className="w-fit normal-case">
              No longer available
            </Badge>
          ) : !item.isInStock ? (
            <Badge variant="error" className="w-fit normal-case">
              Insufficient stock
            </Badge>
          ) : (
            <Badge variant="success" className="w-fit normal-case">
              In Stock
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:w-28 sm:flex-col sm:items-start sm:justify-center sm:gap-0.5">
        <span className="text-sm font-semibold text-text">
          {item.unitAmount !== null ? formatPrice(item.unitAmount, currencyCode) : "—"}
        </span>
        {item.originalAmount !== null ? (
          <span className="text-xs text-text-secondary line-through">
            {formatPrice(item.originalAmount, currencyCode)}
          </span>
        ) : null}
        {item.discountPercent !== null ? (
          <Badge variant="neutral" className="normal-case">
            Save {item.discountPercent}%
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 sm:w-auto sm:justify-center">
        <QuantityStepper
          value={item.quantity}
          onChange={(next) => {
            if (next < 1) return;
            void updateItem(item.id, next);
          }}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center justify-between gap-3 sm:w-24 sm:justify-end">
        <span className="text-sm font-semibold text-text">
          {item.lineTotal !== null ? formatPrice(item.lineTotal, currencyCode) : "—"}
        </span>
        <button
          type="button"
          aria-label={`Remove ${item.productName} from cart`}
          disabled={isPending}
          onClick={() => void removeItem(item.id)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-primary-light/50 hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function OrderSummary({ currencyCode, subtotalAmount, itemCount }: { currencyCode: string; subtotalAmount: number; itemCount: number }) {
  const { marketCode } = useMarket();
  const [methods, setMethods] = useState<ShippingMethodView[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getShippingMethods(marketCode)
      .then((list) => {
        if (!cancelled) setMethods(list);
      })
      .catch(() => {
        if (!cancelled) setMethods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [marketCode]);

  const method = methods?.find((m) => m.isActive) ?? null;
  const threshold = method?.freeShippingThreshold ?? null;
  const isFreeShipping = method !== null && (threshold === null || subtotalAmount >= threshold);
  const shippingAmount = method ? (isFreeShipping ? 0 : method.baseRate) : null;
  const total = shippingAmount !== null ? subtotalAmount + shippingAmount : null;

  return (
    <Card className="flex h-fit flex-col gap-5">
      <h2 className="font-serif text-xl font-semibold text-text">Order Summary</h2>

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Subtotal ({itemCount} items)</span>
          <span className="font-medium text-text">{formatPrice(subtotalAmount, currencyCode)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Shipping</span>
          <span className="font-medium text-text">
            {shippingAmount === null ? "—" : shippingAmount === 0 ? "Free" : formatPrice(shippingAmount, currencyCode)}
          </span>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-text">Total</span>
          <span className="text-xl font-semibold text-text">
            {total !== null ? formatPrice(total, currencyCode) : formatPrice(subtotalAmount, currencyCode)}
          </span>
        </div>
      </div>

      {!isFreeShipping && threshold !== null ? (
        <div className="flex items-start gap-2 rounded-md bg-success/10 px-3 py-2.5 text-sm">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <p className="text-text">
            Spend {formatPrice(threshold - subtotalAmount, currencyCode)} more for free shipping.
          </p>
        </div>
      ) : isFreeShipping && threshold !== null ? (
        <div className="flex items-start gap-2 rounded-md bg-success/10 px-3 py-2.5 text-sm">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-medium text-text">You&apos;re eligible for free shipping!</p>
            <p className="text-text-secondary">
              Enjoy free shipping on orders above {formatPrice(threshold, currencyCode)}.
            </p>
          </div>
        </div>
      ) : null}

      <Button href="/checkout" className="w-full">
        Proceed to Checkout →
      </Button>

      <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 text-center text-xs text-text-secondary">
        <div className="flex flex-col items-center gap-1">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-medium text-text">Secure Checkout</span>
          <span>Your information is safe</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <RotateCcw className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-medium text-text">Easy Returns</span>
          <span>Hassle-free returns</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Headset className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-medium text-text">24/7 Support</span>
          <span>We&apos;re here to help</span>
        </div>
      </div>
    </Card>
  );
}

export function CartView() {
  const { status } = useAuth();
  const { cart, isCartLoading, cartError, clearCart, refreshCart, pendingKeys } = useCartWishlist();

  if (status === "unauthenticated") {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-8 w-8" aria-hidden />}
        title="Sign in to view your cart"
        description="Your cart is tied to your account. Sign in to see items you've added."
        action={<Button href="/login?redirect=%2Fcart">Sign In</Button>}
      />
    );
  }

  if (isCartLoading && !cart) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
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
        description="Browse our products and add something you like."
        action={<Button href="/products">Continue Shopping</Button>}
      />
    );
  }

  const isClearing = pendingKeys.has("clear");

  return (
    <div className="flex flex-col gap-10">
      {cartError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
          {cartError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="flex flex-col gap-0">
          <div className="flex items-center justify-between pb-4">
            <h2 className="font-serif text-xl font-semibold text-text">
              Shopping Cart <span className="text-sm font-normal text-text-secondary">({cart.itemCount} items)</span>
            </h2>
            <Link href="/products" className="text-sm font-medium text-primary-dark hover:underline">
              Continue Shopping →
            </Link>
          </div>

          <div className="hidden border-y border-border bg-primary-light/20 px-2 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary sm:grid sm:grid-cols-[1fr_7rem_8rem_6rem]">
            <span>Product</span>
            <span>Price</span>
            <span className="text-center">Quantity</span>
            <span className="text-right">Total</span>
          </div>

          <div>
            {cart.items.map((item) => (
              <CartItemRow key={item.id} item={item} currencyCode={cart.currencyCode} />
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={isClearing}
              isLoading={isClearing}
              onClick={() => void clearCart()}
            >
              Clear Cart
            </Button>
          </div>
        </Card>

        <OrderSummary
          currencyCode={cart.currencyCode}
          subtotalAmount={cart.subtotalAmount}
          itemCount={cart.itemCount}
        />
      </div>

      <CartRecommendations excludeProductIds={cart.items.map((item) => item.productId)} />
    </div>
  );
}
