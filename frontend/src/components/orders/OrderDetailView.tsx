"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api";
import { getOrder } from "@/lib/api/orders";
import {
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABELS,
  ORDERS_ERROR_MESSAGES,
  PAYMENT_STATUS_BADGE_VARIANT,
  PAYMENT_STATUS_DESCRIPTIONS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/types/orders";
import type { OrderDetailView as OrderDetailData } from "@/lib/types/orders";
import type { OrderAddressView } from "@/lib/types/checkout";

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(
    amount / 100
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

function AddressBlock({ address }: { address: OrderAddressView }) {
  return (
    <p className="text-sm text-text-secondary">
      {address.fullName}
      <br />
      {address.line1}
      {address.line2 ? (
        <>
          <br />
          {address.line2}
        </>
      ) : null}
      <br />
      {address.city}
      {address.region ? `, ${address.region}` : ""} {address.postalCode ?? ""}
      <br />
      {address.countryCode}
      <br />
      {address.phone}
    </p>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return ORDERS_ERROR_MESSAGES[error.code ?? ""] ?? error.message;
  }
  return "Couldn't load this order.";
}

export function OrderDetailView({ orderId, justPlaced }: { orderId: string; justPlaced: boolean }) {
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Split from `load` so the mount effect body contains no synchronous
  // setState (react-hooks/set-state-in-effect): on mount the state already is
  // { isLoading: true, error: null }, so only the retry path needs to reset it.
  const fetchOrder = useCallback(() => {
    getOrder(orderId)
      .then((data) => {
        setOrder(data);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [orderId]);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetchOrder();
  }, [fetchOrder]);

  useEffect(fetchOrder, [fetchOrder]);

  if (isLoading && !order) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return <ErrorState message={error ?? "Couldn't load this order."} onRetry={load} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {justPlaced ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm font-medium text-success"
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          Order placed! We&apos;ll send updates as it ships.
        </p>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-xl font-semibold text-text">{order.orderNumber}</p>
            <p className="text-sm text-text-secondary">Placed {formatDate(order.placedAt)}</p>
          </div>
          <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold text-text">Payment</h2>
            <p className="text-sm text-text-secondary">
              {order.paymentMethod === "COD" ? "Cash on Delivery" : order.paymentMethod}
            </p>
          </div>
          <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[order.paymentStatus]}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </Badge>
        </div>
        {PAYMENT_STATUS_DESCRIPTIONS[order.paymentStatus] ? (
          <p className="mt-2 text-sm text-text-secondary">
            {PAYMENT_STATUS_DESCRIPTIONS[order.paymentStatus]}
          </p>
        ) : null}
      </Card>

      {order.billingAddress || order.shippingAddress ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {order.billingAddress ? (
            <Card>
              <h2 className="mb-2 font-serif text-lg font-semibold text-text">Billing Address</h2>
              <AddressBlock address={order.billingAddress} />
            </Card>
          ) : null}
          {order.shippingAddress ? (
            <Card>
              <h2 className="mb-2 font-serif text-lg font-semibold text-text">Shipping Address</h2>
              <AddressBlock address={order.shippingAddress} />
            </Card>
          ) : null}
        </div>
      ) : null}

      <Card>
        <h2 className="mb-4 font-serif text-lg font-semibold text-text">Items</h2>
        <div className="flex flex-col gap-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
              <div>
                <p className="font-medium text-text">{item.productName}</p>
                {item.variantName ? (
                  <p className="text-sm text-text-secondary">{item.variantName}</p>
                ) : null}
                <p className="text-sm text-text-secondary">
                  SKU: {item.sku} · Qty {item.quantity}
                </p>
              </div>
              <span className="font-medium text-text">
                {formatPrice(item.lineTotal, item.currencyCode)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Subtotal</span>
            <span className="text-text">{formatPrice(order.subtotalAmount, order.currencyCode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Discount</span>
            <span className="text-text">{formatPrice(order.discountAmount, order.currencyCode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Shipping</span>
            <span className="text-text">{formatPrice(order.shippingAmount, order.currencyCode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Tax</span>
            <span className="text-text">{formatPrice(order.taxAmount, order.currencyCode)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span className="text-text">Total</span>
            <span className="text-text">{formatPrice(order.totalAmount, order.currencyCode)}</span>
          </div>
        </div>
      </Card>

      {order.statusHistory.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-serif text-lg font-semibold text-text">Status History</h2>
          <div className="flex flex-col gap-2 text-sm">
            {order.statusHistory.map((entry, idx) => (
              <div key={idx} className="flex justify-between gap-3">
                <span className="text-text">
                  {entry.previousStatus ? `${ORDER_STATUS_LABELS[entry.previousStatus]} → ` : ""}
                  {ORDER_STATUS_LABELS[entry.newStatus]}
                </span>
                <span className="text-text-secondary">{formatDate(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
