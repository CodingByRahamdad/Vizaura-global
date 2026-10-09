import { getEmailProvider } from "../../integrations/email/index.js";

/// Single shared call site for the "an order was created" email — used by
/// both checkout.service.ts (storefront orders) and orders.service.ts
/// (admin-entered offline orders), so there is exactly one place this logic
/// lives, not one per creation path.
///
/// Never rethrows: a missing/invalid customer email or a provider failure
/// must never block or roll back order creation, which has already
/// committed by the time this is called.
export async function sendOrderConfirmation(params: {
  to: string;
  firstName: string;
  orderNumber: string;
  totalAmount: number;
  currencyCode: string;
}): Promise<void> {
  if (!params.to || !params.to.includes("@")) {
    console.error(`order confirmation email skipped for order ${params.orderNumber}: missing/invalid email address`);
    return;
  }

  try {
    await getEmailProvider().sendOrderConfirmationEmail(params);
  } catch (error) {
    console.error(`order confirmation email failed for order ${params.orderNumber}:`, error);
  }
}
