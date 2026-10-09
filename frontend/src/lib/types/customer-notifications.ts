/**
 * Mirrors backend/src/modules/notifications's CustomerNotification shape.
 * Distinct from lib/types/admin-notifications.ts — a different, ownership-
 * scoped feed, not the admin permission-scoped one.
 */

export type CustomerNotificationType = "ORDER_STATUS_CHANGED" | "PROMOTION";

export interface CustomerNotificationView {
  id: string;
  type: CustomerNotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export const CUSTOMER_NOTIFICATION_LABELS: Record<CustomerNotificationType, string> = {
  ORDER_STATUS_CHANGED: "Order update",
  PROMOTION: "Promotion",
};
