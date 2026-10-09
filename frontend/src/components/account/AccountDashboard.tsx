"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Lock,
  Mail,
  MapPin,
  Package,
  User,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SafeImage } from "@/components/ui/SafeImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useCartWishlist } from "@/context/CartWishlistContext";
import { ApiError } from "@/lib/api";
import { listAllOrders, listOrders } from "@/lib/api/orders";
import { getMyAddresses } from "@/lib/api/addresses";
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

/** Never sums across currencies — a customer could have orders from more than one market. */
function totalSpentByCurrency(orders: OrderSummaryView[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const order of orders) {
    totals[order.currencyCode] = (totals[order.currencyCode] ?? 0) + order.totalAmount;
  }
  return totals;
}

export function AccountDashboard() {
  const { user } = useAuth();
  const { wishlistCount } = useCartWishlist();
  const [orders, setOrders] = useState<OrderSummaryView[] | null>(null);
  const [totalOrders, setTotalOrders] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderSummaryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedAddressCount, setSavedAddressCount] = useState<number | null>(null);

  // Split from `load` so the mount effect body contains no synchronous
  // setState (react-hooks/set-state-in-effect): on mount the state already is
  // { isLoading: true, error: null }, so only the retry path needs to reset it.
  const fetchOrders = useCallback(() => {
    Promise.all([listAllOrders(), listOrders({ page: 1, limit: 4 })])
      .then(([{ orders: all, total }, recent]) => {
        setOrders(all);
        setTotalOrders(total);
        setRecentOrders(recent.data);
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

  useEffect(() => {
    getMyAddresses()
      .then(({ billing, shipping }) => setSavedAddressCount((billing ? 1 : 0) + (shipping ? 1 : 0)))
      .catch(() => setSavedAddressCount(0));
  }, []);

  if (!user) return null;

  const recentOrdersList = recentOrders ?? [];
  const spentByCurrency = orders ? totalSpentByCurrency(orders) : {};
  const currencies = Object.keys(spentByCurrency);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-lg px-6 py-8 text-white sm:px-10 sm:py-10">
        <SafeImage
          src="/cus-dash/cus-dash.webp"
          alt=""
          className="absolute inset-0 -z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/40 to-primary-dark/55" />

        <p className="text-xs font-semibold uppercase tracking-widest text-primary-light">
          Welcome Back
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold sm:text-4xl">
          {user.firstName} {user.lastName}
        </h1>
        <p className="mt-2 max-w-lg text-white/85">
          Manage your account, track orders and explore your favorite natural products.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light/50 text-primary-dark">
            <Package className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm text-text-secondary">Total Orders</p>
          {isLoading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <p className="text-2xl font-semibold text-text">{totalOrders ?? 0}</p>
          )}
          <Link href="/account/orders" className="text-sm font-medium text-primary hover:underline">
            View all orders <ArrowRight className="inline h-3.5 w-3.5" aria-hidden />
          </Link>
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light/50 text-primary-dark">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm text-text-secondary">Total Spent</p>
          {isLoading ? (
            <Skeleton className="h-7 w-20" />
          ) : currencies.length === 0 ? (
            <p className="text-2xl font-semibold text-text">—</p>
          ) : (
            <div className="flex flex-col">
              {currencies.map((code) => (
                <p key={code} className="text-2xl font-semibold text-text">
                  {formatPrice(spentByCurrency[code], code)}
                </p>
              ))}
            </div>
          )}
          <Link href="/account/orders" className="text-sm font-medium text-primary hover:underline">
            View spending <ArrowRight className="inline h-3.5 w-3.5" aria-hidden />
          </Link>
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error">
            <Heart className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm text-text-secondary">Wishlist Items</p>
          <p className="text-2xl font-semibold text-text">{wishlistCount}</p>
          <Link href="/account/wishlist" className="text-sm font-medium text-primary hover:underline">
            View wishlist <ArrowRight className="inline h-3.5 w-3.5" aria-hidden />
          </Link>
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light/50 text-primary-dark">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm text-text-secondary">Saved Addresses</p>
          {savedAddressCount === null ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <p className="text-2xl font-semibold text-text">{savedAddressCount}/2</p>
          )}
          <Link href="/account/addresses" className="text-sm font-medium text-primary hover:underline">
            Manage addresses <ArrowRight className="inline h-3.5 w-3.5" aria-hidden />
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-text">Recent Orders</h2>
            <Link href="/account/orders" className="text-sm font-medium text-primary hover:underline">
              View All Orders <ArrowRight className="inline h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : recentOrdersList.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8" aria-hidden />}
              title="No orders yet"
              description="Once you place an order, it will show up here."
              action={<Button href="/products">Browse Products</Button>}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recentOrdersList.map((order) => (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="flex flex-col gap-2 rounded-md border border-border px-3 py-3 transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-primary-light/40">
                      <SafeImage
                        src={order.thumbnailUrl}
                        alt={order.orderNumber}
                        fallback={<Package className="h-4 w-4 text-primary-dark" aria-hidden />}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-text">{order.orderNumber}</p>
                      <p className="text-xs text-text-secondary">{formatDate(order.placedAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                    <span className="text-sm font-semibold text-text">
                      {formatPrice(order.totalAmount, order.currencyCode)}
                    </span>
                    <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                    <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[order.paymentStatus]}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </Badge>
                    <span className="text-sm font-medium text-primary">View Details</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-primary-dark px-5 py-6 text-white">
            <h3 className="font-serif text-lg font-semibold">Need Help?</h3>
            <p className="mt-2 text-sm text-white/80">
              Our support team is here to assist you with any questions or concerns.
            </p>
            <Button href="/contact" variant="secondary" size="sm" className="mt-4">
              Contact Support
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-cream px-5 py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light/60 text-primary-dark">
              <Mail className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="mt-3 font-serif text-lg font-semibold text-text">Stay Updated</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Get exclusive offers, new arrivals and order updates in your notifications.
            </p>
            <Button href="/account/notifications" variant="outline" size="sm" className="mt-4">
              View Notifications
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-serif text-lg font-semibold text-text">Quick Links</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <QuickLink href="/account/orders" icon={Package} label="My Orders" />
          <QuickLink href="/account/addresses" icon={MapPin} label="Addresses" />
          <QuickLink href="/account/wishlist" icon={Heart} label="Wishlist" />
          <QuickLink href="/account/profile" icon={User} label="Profile" />
          <QuickLink href="/account/change-password" icon={Lock} label="Change Password" />
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Package;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-3 py-4 text-center transition-colors hover:border-primary"
    >
      <Icon className="h-5 w-5 text-primary-dark" aria-hidden />
      <span className="text-xs font-medium text-text">{label}</span>
    </Link>
  );
}
