/** Mirrors backend/src/modules/notifications's Notification + read-state shape. */

export type AdminNotificationType =
  | "ORDER_PLACED"
  | "CUSTOMER_REGISTERED"
  | "PRODUCT_CREATED"
  | "CATEGORY_CREATED"
  | "REVIEW_SUBMITTED"
  | "PROMOTION_CREATED"
  | "ORDER_CANCELLED";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  requiredPermission: string;
  createdAt: string;
  read: boolean;
}
