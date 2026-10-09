import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.coerce.number().int().min(0).default(0), // plain offset — small table, no need for a keyset cursor
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const notificationIdParamsSchema = z.object({
  id: z.uuid(),
});

// Same shape as listNotificationsQuerySchema — kept as a separate export so
// the two notification surfaces (admin feed vs. customer feed) can diverge
// independently later without one accidentally changing the other.
export const listCustomerNotificationsQuerySchema = listNotificationsQuerySchema;

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;
export type ListCustomerNotificationsQuery = z.infer<typeof listCustomerNotificationsQuerySchema>;
