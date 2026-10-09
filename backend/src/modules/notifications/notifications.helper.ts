import { CustomerNotificationsService, NotificationsService, type CustomerNotifyInput, type NotifyInput } from "./notifications.service.js";

const notificationsService = new NotificationsService();
const customerNotificationsService = new CustomerNotificationsService();

/// Thin module-level helper so creation points don't each instantiate
/// NotificationsService themselves — same "one shared helper" posture as
/// auditLog.helper.ts's recordAudit. Never throws.
export async function notifyAdmins(input: NotifyInput): Promise<void> {
  await notificationsService.notify(input);
}

/// Customer-facing counterpart. Called from Orders' status-transition path
/// (and anywhere else a single customer needs to be notified). Never throws.
export async function notifyCustomer(userId: string, input: CustomerNotifyInput): Promise<void> {
  await customerNotificationsService.notify(userId, input);
}
