export interface EmailProvider {
  sendEmailVerification(params: { to: string; firstName: string; verifyUrl: string }): Promise<void>;
  sendPasswordReset(params: { to: string; firstName: string; resetUrl: string }): Promise<void>;
  /// Sent when someone tries to register with an address that already has an
  /// account, instead of a distinguishable error — see auth.service.ts.
  sendExistingAccountNotice(params: { to: string; firstName: string }): Promise<void>;

  /// Contact Us form submission, routed to a business inbox (never the
  /// visitor) with the visitor's address set as Reply-To — see
  /// modules/contact/contact.service.ts.
  sendContactMessage(params: {
    to: string;
    replyTo: string;
    fullName: string;
    phone?: string;
    subject: string;
    message: string;
  }): Promise<void>;

  /// Sent once an order is successfully created — both a storefront checkout
  /// and an admin-entered offline order (see
  /// modules/orders/orderConfirmation.helper.ts, the single shared call site
  /// both paths use).
  sendOrderConfirmationEmail(params: {
    to: string;
    firstName: string;
    orderNumber: string;
    totalAmount: number;
    currencyCode: string;
  }): Promise<void>;
}
