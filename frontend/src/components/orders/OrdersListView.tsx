"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api";
import { listOrders } from "@/lib/api/orders";
import {
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABELS,
  ORDERS_ERROR_MESSAGES,
  PAYMENT_STATUS_BADGE_VARIANT,
  PAYMENT_STATUS_LABELS,
} from "@/lib/types/orders";
import type { OrderSummaryView } from "@/lib/types/orders";

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(
    amount / 100
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return ORDERS_ERROR_MESSAGES[error.code ?? ""] ?? error.message;
  }
  return "Couldn't load your orders.";
}

export function OrdersListView() {
  const [orders, setOrders] = useState<OrderSummaryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Split from `load` so the mount effect body contains no synchronous
  // setState (react-hooks/set-state-in-effect): on mount the state already is
  // { isLoading: true, error: null }, so only the retry path needs to reset it.
  const fetchOrders = useCallback(() => {
    listOrders()
      .then(({ data }) => {
        setOrders(data);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetchOrders();
  }, [fetchOrders]);

  useEffect(fetchOrders, [fetchOrders]);

  if (isLoading && !orders) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error && !orders) {
    return <ErrorState message={error} onRetry={load} />;
  }

  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-8 w-8" aria-hidden />}
        title="No orders yet"
        description="Once you place an order, it will show up here."
        action={<Button href="/products">Browse Products</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/account/orders/${order.id}`}
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium text-text">{order.orderNumber}</p>
            <p className="text-sm text-text-secondary">{formatDate(order.placedAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
            <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[order.paymentStatus]}>
              {PAYMENT_STATUS_LABELS[order.paymentStatus]}
            </Badge>
            <span className="font-semibold text-text">
              {formatPrice(order.totalAmount, order.currencyCode)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
