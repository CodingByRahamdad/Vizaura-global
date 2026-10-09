"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/admin/notifications";
import type { AdminNotification } from "@/lib/types/admin-notifications";

const POLL_INTERVAL_MS = 30_000;

const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  Order: (id) => `/admin/orders/${id}`,
  User: (id) => `/admin/customers/${id}`,
  Product: (id) => `/admin/products/${id}`,
  Category: (id) => `/admin/categories/${id}`,
  Review: (id) => `/admin/reviews/${id}`,
  Promotion: (id) => `/admin/promotions/${id}`,
};

const PAGE_SIZE = 20;

function entityHref(notification: AdminNotification): string | null {
  const resolve = ENTITY_ROUTES[notification.entityType];
  return resolve ? resolve(notification.entityId) : null;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/// Replaces the old disabled bell <button>. No real-time/polling pattern
/// existed anywhere in this frontend before this component — a plain
/// fetch + interval poll is the smallest addition that satisfies "update
/// without a manual refresh" without adding a new dependency (SWR/WebSocket).
export function AdminNotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState(0);

  // Not an async function (fire-and-forget .then/.catch instead) so it can
  // be passed directly as an effect callback below — an async function
  // always returns a Promise, which isn't a valid effect return value.
  const refreshUnreadCount = useCallback(() => {
    getUnreadNotificationCount()
      .then((count) => setUnreadCount(count))
      .catch(() => {
        // Silent — the badge just stays at its last known value; the panel
        // itself surfaces a real error state when opened.
      });
  }, []);

  // Split into two effects so the mount-time fetch is the effect callback
  // itself (same shape as account/AccountDashboard.tsx's fetchOrders) rather
  // than a function invoked from inside an arrow-function effect body — the
  // latter trips react-hooks/set-state-in-effect even though the setState
  // inside refreshUnreadCount only ever runs after an await.
  useEffect(refreshUnreadCount, [refreshUnreadCount]);

  useEffect(() => {
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  async function loadNotifications() {
    setLoading(true);
    setError(false);
    try {
      const page = await getNotifications({ limit: PAGE_SIZE });
      setNotifications(page.data);
      setTotal(page.meta.total);
      setNextCursor(page.meta.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  /// Appends the next page rather than replacing — backend-driven offset
  /// pagination via the existing `cursor` param (never fetches everything
  /// up front and slices client-side).
  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const page = await getNotifications({ limit: PAGE_SIZE, cursor: nextCursor });
      setNotifications((current) => (current ? [...current, ...page.data] : page.data));
      setTotal(page.meta.total);
      setNextCursor(page.meta.nextCursor);
    } catch {
      // Silent — the list just stays at what's already loaded; the user can retry the button.
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleMarkRead(notification: AdminNotification) {
    if (notification.read) return;
    setNotifications((current) =>
      current ? current.map((n) => (n.id === notification.id ? { ...n, read: true } : n)) : current
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await markNotificationRead(notification.id);
    } catch {
      refreshUnreadCount();
    }
  }

  async function handleMarkAllRead() {
    setNotifications((current) => (current ? current.map((n) => ({ ...n, read: true })) : current));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      refreshUnreadCount();
    }
  }

  return (
    <Dropdown
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={() => {
            toggle();
            if (!open) loadNotifications();
          }}
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          className="relative rounded-full p-2 text-text-secondary hover:bg-bg"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      )}
      panelClassName="right-0 w-80 max-w-[calc(100vw-1.5rem)] py-2"
    >
      {({ close }) => (
        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <p className="text-sm font-medium text-text">Notifications</p>
            {notifications && notifications.some((n) => !n.read) ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-primary-dark hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                Mark all as read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-text-secondary">Loading…</p>
            ) : error ? (
              <p className="px-4 py-6 text-center text-sm text-error">Couldn&apos;t load notifications.</p>
            ) : !notifications || notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-secondary">No notifications yet.</p>
            ) : (
              notifications.map((notification) => {
                const href = entityHref(notification);
                const content = (
                  <div
                    className={`flex flex-col gap-0.5 px-4 py-3 text-sm ${
                      notification.read ? "" : "bg-primary-light/20"
                    }`}
                  >
                    <p className="font-medium text-text">{notification.title}</p>
                    <p className="text-text-secondary">{notification.message}</p>
                    <p className="text-xs text-text-secondary/70">{formatRelativeTime(notification.createdAt)}</p>
                  </div>
                );
                return href ? (
                  <Link
                    key={notification.id}
                    href={href}
                    onClick={() => {
                      handleMarkRead(notification);
                      close();
                    }}
                    className="block border-b border-border/60 last:border-0 hover:bg-bg"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleMarkRead(notification)}
                    className="block w-full border-b border-border/60 text-left last:border-0 hover:bg-bg"
                  >
                    {content}
                  </button>
                );
              })
            )}
            {notifications && notifications.length > 0 && notifications.length < total ? (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="block w-full px-4 py-2.5 text-center text-sm font-medium text-primary-dark hover:bg-bg disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
