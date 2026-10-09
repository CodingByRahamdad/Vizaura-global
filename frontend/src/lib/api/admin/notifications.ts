import { apiFetch, apiFetchWithMeta } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AdminNotification } from "@/lib/types/admin-notifications";

export interface AdminNotificationsPage {
  data: AdminNotification[];
  meta: { total: number; nextCursor: number };
}

/** GET /admin/notifications?limit=&cursor=&unreadOnly= (notifications:read). */
export async function getNotifications(
  options: { limit?: number; cursor?: number; unreadOnly?: boolean } = {}
): Promise<AdminNotificationsPage> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", String(options.cursor));
  if (options.unreadOnly) params.set("unreadOnly", "true");
  const query = params.toString();
  return withAuthRetry(async () => {
    const { data, meta } = await apiFetchWithMeta<AdminNotification[]>(
      `${ENDPOINTS.admin.notifications}${query ? `?${query}` : ""}`,
      { cache: "no-store" }
    );
    return { data, meta: meta as unknown as { total: number; nextCursor: number } };
  });
}

/** GET /admin/notifications/unread-count (notifications:read). */
export async function getUnreadNotificationCount(): Promise<number> {
  const result = await withAuthRetry(() =>
    apiFetch<{ count: number }>(ENDPOINTS.admin.notificationsUnreadCount, { cache: "no-store" })
  );
  return result.count;
}

/** PATCH /admin/notifications/:id/read (notifications:update). */
export async function markNotificationRead(id: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<void>(ENDPOINTS.admin.notificationRead(id), { method: "PATCH", cache: "no-store" })
  );
}

/** PATCH /admin/notifications/read-all (notifications:update). */
export async function markAllNotificationsRead(): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<void>(ENDPOINTS.admin.notificationsReadAll, { method: "PATCH", cache: "no-store" })
  );
}
