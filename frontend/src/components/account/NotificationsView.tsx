"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Package, Megaphone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  getMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "@/lib/api/customer-notifications";
import type { CustomerNotificationType, CustomerNotificationView } from "@/lib/types/customer-notifications";

const PAGE_SIZE = 20;

const TYPE_ICON: Record<CustomerNotificationType, typeof Package> = {
  ORDER_STATUS_CHANGED: Package,
  PROMOTION: Megaphone,
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function NotificationsView() {
  const [notifications, setNotifications] = useState<CustomerNotificationView[] | null>(null);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  // No synchronous setState before the fetch (react-hooks/set-state-in-effect)
  // — mirrors AccountDashboard.tsx's fetchOrders/load split.
  const fetchNotifications = useCallback(() => {
    getMyNotifications({ limit: PAGE_SIZE })
      .then((page) => {
        setNotifications(page.data);
        setTotal(page.meta.total);
        setNextCursor(page.meta.nextCursor);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, []);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(false);
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(fetchNotifications, [fetchNotifications]);

  async function handleLoadMore() {
    setIsLoadingMore(true);
    try {
      const page = await getMyNotifications({ limit: PAGE_SIZE, cursor: nextCursor });
      setNotifications((current) => (current ? [...current, ...page.data] : page.data));
      setTotal(page.meta.total);
      setNextCursor(page.meta.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleMarkRead(notification: CustomerNotificationView) {
    if (notification.isRead) return;
    setNotifications((current) =>
      current ? current.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)) : current
    );
    try {
      await markMyNotificationRead(notification.id);
    } catch {
      void load();
    }
  }

  async function handleMarkAllRead() {
    setNotifications((current) => (current ? current.map((n) => ({ ...n, isRead: true })) : current));
    try {
      await markAllMyNotificationsRead();
    } catch {
      void load();
    }
  }

  if (isLoading && !notifications) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error && !notifications) {
    return <ErrorState message="Couldn't load your notifications." onRetry={() => void load()} />;
  }

  if (!notifications || notifications.length === 0) {
    return (
      <EmptyState
        icon={<Bell className="h-8 w-8" aria-hidden />}
        title="No notifications yet"
        description="Order updates and promotions will show up here."
      />
    );
  }

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <Card className="p-0">
      {hasUnread ? (
        <div className="flex items-center justify-end border-b border-border px-4 py-2.5">
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-sm text-primary-dark hover:underline"
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
            Mark all as read
          </button>
        </div>
      ) : null}
      <div>
        {notifications.map((notification) => {
          const Icon = TYPE_ICON[notification.type];
          return (
            <button
              key={notification.id}
              type="button"
              onClick={() => handleMarkRead(notification)}
              className={`flex w-full items-start gap-3 border-b border-border/60 px-4 py-4 text-left last:border-0 hover:bg-bg ${
                notification.isRead ? "" : "bg-primary-light/20"
              }`}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-text">{notification.title}</span>
                  {!notification.isRead ? <span className="h-2 w-2 rounded-full bg-primary" aria-hidden /> : null}
                </span>
                <span className="mt-0.5 block text-sm text-text-secondary">{notification.message}</span>
                <span className="mt-1 block text-xs text-text-secondary/70">{formatDate(notification.createdAt)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {notifications.length < total ? (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isLoadingMore}
          className="block w-full px-4 py-3 text-center text-sm font-medium text-primary-dark hover:bg-bg disabled:opacity-60"
        >
          {isLoadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </Card>
  );
}
