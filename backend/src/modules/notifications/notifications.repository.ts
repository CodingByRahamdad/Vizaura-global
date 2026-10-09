import type {
  CustomerNotification,
  CustomerNotificationType,
  Notification,
  NotificationType,
  PrismaClient,
} from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export interface CreateNotificationData {
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  requiredPermission: string;
}

export interface NotificationRow extends Notification {
  read: boolean;
}

export interface CreateCustomerNotificationData {
  type: CustomerNotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

/// Only this file touches Prisma for notifications. `create` is a no-op on
/// a duplicate event (the `@@unique([type, entityId])` constraint on
/// Notification is the dedup guarantee) — callers never need their own
/// existence check first.
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async create(data: CreateNotificationData): Promise<void> {
    await this.prisma.notification.upsert({
      where: { type_entityId: { type: data.type, entityId: data.entityId } },
      create: data,
      update: {},
    });
  }

  async listForUser(
    userId: string,
    allowedPermissions: string[],
    options: { skip: number; take: number; unreadOnly: boolean },
  ): Promise<{ rows: NotificationRow[]; total: number }> {
    if (allowedPermissions.length === 0) return { rows: [], total: 0 };

    const where = {
      requiredPermission: { in: allowedPermissions },
      ...(options.unreadOnly ? { reads: { none: { userId } } } : {}),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: options.skip,
        take: options.take,
        include: { reads: { where: { userId }, select: { id: true } } },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      rows: notifications.map(({ reads, ...notification }) => ({ ...notification, read: reads.length > 0 })),
      total,
    };
  }

  async unreadCount(userId: string, allowedPermissions: string[]): Promise<number> {
    if (allowedPermissions.length === 0) return 0;
    return this.prisma.notification.count({
      where: { requiredPermission: { in: allowedPermissions }, reads: { none: { userId } } },
    });
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId, userId } },
      create: { notificationId, userId },
      update: {},
    });
  }

  async markAllRead(userId: string, allowedPermissions: string[]): Promise<void> {
    if (allowedPermissions.length === 0) return;
    const unread = await this.prisma.notification.findMany({
      where: { requiredPermission: { in: allowedPermissions }, reads: { none: { userId } } },
      select: { id: true },
    });
    if (unread.length === 0) return;
    await this.prisma.notificationRead.createMany({
      data: unread.map((notification) => ({ notificationId: notification.id, userId })),
      skipDuplicates: true,
    });
  }

  // -- Customer-facing notifications (CustomerNotification) -----------------
  // Ownership-scoped: ordinary rows keyed by userId, isRead/readAt inline —
  // no join table, no permission filtering. Fully separate storage from the
  // admin Notification/NotificationRead pair above.

  async createForUser(userId: string, data: CreateCustomerNotificationData): Promise<void> {
    await this.prisma.customerNotification.create({ data: { userId, ...data } });
  }

  /// Single batched insert for the admin broadcast action — not N individual
  /// inserts.
  async createForUsers(userIds: string[], data: CreateCustomerNotificationData): Promise<number> {
    if (userIds.length === 0) return 0;
    const result = await this.prisma.customerNotification.createMany({
      data: userIds.map((userId) => ({ userId, ...data })),
    });
    return result.count;
  }

  async listForCustomer(
    userId: string,
    options: { skip: number; take: number; unreadOnly: boolean },
  ): Promise<{ rows: CustomerNotification[]; total: number }> {
    const where = { userId, ...(options.unreadOnly ? { isRead: false } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.customerNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: options.skip,
        take: options.take,
      }),
      this.prisma.customerNotification.count({ where }),
    ]);
    return { rows, total };
  }

  async unreadCountForCustomer(userId: string): Promise<number> {
    return this.prisma.customerNotification.count({ where: { userId, isRead: false } });
  }

  /// Scoped to userId in the query shape itself so a caller can never mark
  /// another customer's notification read by guessing an id.
  async markReadForCustomer(id: string, userId: string): Promise<void> {
    await this.prisma.customerNotification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllReadForCustomer(userId: string): Promise<void> {
    await this.prisma.customerNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
