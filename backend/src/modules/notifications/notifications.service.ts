import { NotificationsRepository, type CreateCustomerNotificationData, type NotificationRow } from "./notifications.repository.js";
import type { CustomerNotification, NotificationType } from "../../generated/prisma/client.js";

export interface NotifyInput {
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  requiredPermission: string;
}

export type CustomerNotifyInput = CreateCustomerNotificationData;

export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository = new NotificationsRepository()) {}

  /// Fire-and-forget, same posture as AuditLogService.record() — a
  /// notification-write failure must never block or fail the real action
  /// (order placed, product created, ...) that triggered it.
  async notify(input: NotifyInput): Promise<void> {
    try {
      await this.notificationsRepository.create(input);
    } catch (error) {
      console.warn(`notifications: failed to record ${input.type} on ${input.entityType}:${input.entityId}`, error);
    }
  }

  async list(
    userId: string,
    allowedPermissions: string[],
    options: { skip: number; take: number; unreadOnly: boolean },
  ): Promise<{ rows: NotificationRow[]; total: number }> {
    return this.notificationsRepository.listForUser(userId, allowedPermissions, options);
  }

  async unreadCount(userId: string, allowedPermissions: string[]): Promise<number> {
    return this.notificationsRepository.unreadCount(userId, allowedPermissions);
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationsRepository.markRead(notificationId, userId);
  }

  async markAllRead(userId: string, allowedPermissions: string[]): Promise<void> {
    await this.notificationsRepository.markAllRead(userId, allowedPermissions);
  }
}

/// Customer-facing counterpart to NotificationsService above. Ownership-
/// scoped, no permission filtering — distinct visibility model from the
/// admin feed, so kept as its own class rather than overloading the one
/// above.
export class CustomerNotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository = new NotificationsRepository()) {}

  /// Fire-and-forget — a notification-write failure must never block the
  /// real action (e.g. an order status transition) that triggered it. Used
  /// by the Orders module via notifyCustomer().
  async notify(userId: string, input: CustomerNotifyInput): Promise<void> {
    try {
      await this.notificationsRepository.createForUser(userId, input);
    } catch (error) {
      console.warn(`notifications: failed to notify customer ${userId} of ${input.type}`, error);
    }
  }

  /// Direct admin action (promotion broadcast) — unlike notify(), failures
  /// must surface to the caller rather than being swallowed.
  async broadcast(userIds: string[], input: CustomerNotifyInput): Promise<number> {
    return this.notificationsRepository.createForUsers(userIds, input);
  }

  async list(
    userId: string,
    options: { skip: number; take: number; unreadOnly: boolean },
  ): Promise<{ rows: CustomerNotification[]; total: number }> {
    return this.notificationsRepository.listForCustomer(userId, options);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationsRepository.unreadCountForCustomer(userId);
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.notificationsRepository.markReadForCustomer(id, userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository.markAllReadForCustomer(userId);
  }
}
