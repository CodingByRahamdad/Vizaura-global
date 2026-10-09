import { apiFetch, apiFetchWithMeta } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { CustomerNotificationView } from "@/lib/types/customer-notifications";

const NO_STORE = { cache: "no-store" as const };

export interface CustomerNotificationsPage {
  data: CustomerNotificationView[];
  meta: { total: number; nextCursor: number };
}

/** GET /notifications?limit=&cursor=&unreadOnly= (authenticate only, ownership-scoped). */
export async function getMyNotifications(
  options: { limit?: number; cursor?: number; unreadOnly?: boolean } = {}
): Promise<CustomerNotificationsPage> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", String(options.cursor));
  if (options.unreadOnly) params.set("unreadOnly", "true");
  const query = params.toString();
  return withAuthRetry(async () => {
    const { data, meta } = await apiFetchWithMeta<CustomerNotificationView[]>(
      `${ENDPOINTS.notifications.root}${query ? `?${query}` : ""}`,
      NO_STORE
    );
    return { data, meta: meta as unknown as { total: number; nextCursor: number } };
  });
}

export async function getMyUnreadNotificationCount(): Promise<number> {
  const result = await withAuthRetry(() =>
    apiFetch<{ count: number }>(ENDPOINTS.notifications.unreadCount, NO_STORE)
  );
  return result.count;
}

export async function markMyNotificationRead(id: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<void>(ENDPOINTS.notifications.read(id), { method: "PATCH", ...NO_STORE })
  );
}

export async function markAllMyNotificationsRead(): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<void>(ENDPOINTS.notifications.readAll, { method: "PATCH", ...NO_STORE })
  );
}
