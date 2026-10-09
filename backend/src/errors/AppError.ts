import { ErrorCodes, type ErrorCode } from "./errorCodes.js";

export type ErrorDetails = Record<string, unknown>;

/// An error that is safe to surface to the client. Anything thrown that is not
/// an AppError is treated as unexpected and reported as a generic 500.
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: ErrorDetails;
  /// Extra context for server-side logs only. Never serialised to a response.
  readonly logContext?: ErrorDetails;

  constructor(params: {
    code: ErrorCode;
    httpStatus: number;
    message: string;
    details?: ErrorDetails;
    logContext?: ErrorDetails;
  }) {
    super(params.message);
    this.name = "AppError";
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.details = params.details;
    this.logContext = params.logContext;
  }
}

// Factories for the failure modes this phase can produce. Messages are
// deliberately generic where a precise one would leak account existence.

export const authErrors = {
  invalidCredentials: () =>
    new AppError({
      code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      httpStatus: 401,
      message: "Invalid email or password.",
    }),

  unauthorized: (message = "Authentication is required.") =>
    new AppError({ code: ErrorCodes.AUTH_UNAUTHORIZED, httpStatus: 401, message }),

  forbidden: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.AUTH_FORBIDDEN,
      httpStatus: 403,
      message: "You do not have permission to perform this action.",
      details,
    }),

  sessionExpired: (message = "Your session has expired. Please sign in again.") =>
    new AppError({ code: ErrorCodes.AUTH_SESSION_EXPIRED, httpStatus: 401, message }),

  invalidRefreshToken: () =>
    new AppError({
      code: ErrorCodes.AUTH_INVALID_REFRESH_TOKEN,
      httpStatus: 401,
      message: "Invalid refresh token.",
    }),

  refreshReuseDetected: () =>
    new AppError({
      code: ErrorCodes.AUTH_REFRESH_REUSE_DETECTED,
      httpStatus: 401,
      message: "Refresh token reuse detected. All sessions in this family were revoked.",
    }),

  refreshRetry: () =>
    new AppError({
      code: ErrorCodes.AUTH_REFRESH_RETRY,
      httpStatus: 401,
      message: "This refresh token was just rotated. Retry with the latest token.",
    }),

  emailNotVerified: () =>
    new AppError({
      code: ErrorCodes.AUTH_EMAIL_NOT_VERIFIED,
      httpStatus: 403,
      message: "Your email address must be verified before you can continue.",
    }),

  invalidVerificationToken: () =>
    new AppError({
      code: ErrorCodes.AUTH_INVALID_VERIFICATION_TOKEN,
      httpStatus: 400,
      message: "This verification link is invalid or has expired.",
    }),

  invalidResetToken: () =>
    new AppError({
      code: ErrorCodes.AUTH_INVALID_RESET_TOKEN,
      httpStatus: 400,
      message: "This password reset link is invalid or has expired.",
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.AUTH_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),

  rateLimited: (retryAfterSeconds?: number) =>
    new AppError({
      code: ErrorCodes.AUTH_RATE_LIMITED,
      httpStatus: 429,
      message: "Too many requests. Please try again later.",
      details: retryAfterSeconds === undefined ? undefined : { retryAfterSeconds },
    }),

  accountSuspended: () =>
    new AppError({
      code: ErrorCodes.AUTH_ACCOUNT_SUSPENDED,
      httpStatus: 403,
      message: "This account is not permitted to sign in. Please contact support.",
    }),

  passwordReused: () =>
    new AppError({
      code: ErrorCodes.AUTH_PASSWORD_REUSED,
      httpStatus: 422,
      message: "The new password must be different from the current password.",
    }),

  emailAlreadyInUse: () =>
    new AppError({
      code: ErrorCodes.AUTH_EMAIL_ALREADY_IN_USE,
      httpStatus: 409,
      message: "An account with this email already exists.",
    }),

  emailUnchanged: () =>
    new AppError({
      code: ErrorCodes.AUTH_EMAIL_UNCHANGED,
      httpStatus: 422,
      message: "The new email must be different from your current email.",
    }),

  captchaRequired: () =>
    new AppError({
      code: ErrorCodes.AUTH_CAPTCHA_REQUIRED,
      httpStatus: 403,
      message: "CAPTCHA verification is required.",
      details: { captchaRequired: true },
    }),

  captchaFailed: () =>
    new AppError({
      code: ErrorCodes.AUTH_CAPTCHA_FAILED,
      httpStatus: 403,
      message: "CAPTCHA verification failed.",
      details: { captchaRequired: true },
    }),

  captchaUnavailable: () =>
    new AppError({
      code: ErrorCodes.CAPTCHA_UNAVAILABLE,
      httpStatus: 503,
      message: "CAPTCHA verification is temporarily unavailable. Please try again.",
    }),

  csrfFailed: (message = "Request origin could not be verified.") =>
    new AppError({ code: ErrorCodes.CSRF_VALIDATION_FAILED, httpStatus: 403, message }),
};

export const catalogErrors = {
  notFound: (resource: string) =>
    new AppError({
      code: ErrorCodes.CATALOG_NOT_FOUND,
      httpStatus: 404,
      message: `${resource} not found.`,
    }),

  slugConflict: (slug: string) =>
    new AppError({
      code: ErrorCodes.CATALOG_SLUG_CONFLICT,
      httpStatus: 409,
      message: "This slug is already in use.",
      details: { slug },
    }),

  skuConflict: (sku: string) =>
    new AppError({
      code: ErrorCodes.CATALOG_SKU_CONFLICT,
      httpStatus: 409,
      message: "This SKU is already in use.",
      details: { sku },
    }),

  duplicateOptionName: (name: string) =>
    new AppError({
      code: ErrorCodes.CATALOG_DUPLICATE_OPTION_NAME,
      httpStatus: 409,
      message: "This product already has an option with this name.",
      details: { name },
    }),

  duplicateOptionValue: (value: string) =>
    new AppError({
      code: ErrorCodes.CATALOG_DUPLICATE_OPTION_VALUE,
      httpStatus: 409,
      message: "This option already has this value.",
      details: { value },
    }),

  invalidOptionValue: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.CATALOG_INVALID_OPTION_VALUE,
      httpStatus: 422,
      message: "One or more option values are invalid for this product, or assign two values of the same option.",
      details,
    }),

  lastVariant: () =>
    new AppError({
      code: ErrorCodes.CATALOG_LAST_VARIANT,
      httpStatus: 422,
      message: "A product must always have at least one variant.",
    }),

  optionValueInUse: () =>
    new AppError({
      code: ErrorCodes.CATALOG_OPTION_VALUE_IN_USE,
      httpStatus: 409,
      message: "This option value is assigned to at least one variant and cannot be removed.",
    }),

  optionInUse: () =>
    new AppError({
      code: ErrorCodes.CATALOG_OPTION_IN_USE,
      httpStatus: 409,
      message: "This option has values assigned to at least one variant and cannot be removed.",
    }),

  categoryInUse: () =>
    new AppError({
      code: ErrorCodes.CATALOG_CATEGORY_IN_USE,
      httpStatus: 409,
      message: "This category has subcategories or products assigned and cannot be removed.",
    }),

  invalidCategoryParent: () =>
    new AppError({
      code: ErrorCodes.CATALOG_INVALID_CATEGORY_PARENT,
      httpStatus: 422,
      message: "A category cannot be its own ancestor.",
    }),

  duplicateVariantCombination: () =>
    new AppError({
      code: ErrorCodes.CATALOG_DUPLICATE_VARIANT_COMBINATION,
      httpStatus: 409,
      message: "Another variant of this product already has this exact combination of option values.",
    }),

  /// A DRAFT product (never published) is soft-deleted directly. An ACTIVE
  /// product must go through Archive first (status -> ARCHIVED, reversible,
  /// already hides it from customers) before it can be permanently deleted.
  notDeletable: (status: string) =>
    new AppError({
      code: ErrorCodes.CATALOG_PRODUCT_NOT_DELETABLE,
      httpStatus: 409,
      message: "Only DRAFT products can be deleted directly, and only ARCHIVED products can be permanently deleted. Archive this product first.",
      details: { status },
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.CATALOG_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const pricingErrors = {
  notFound: () =>
    new AppError({
      code: ErrorCodes.PRICING_NOT_FOUND,
      httpStatus: 404,
      message: "No price is configured for this variant in this market.",
    }),

  currencyMismatch: (expected: string, received: string) =>
    new AppError({
      code: ErrorCodes.PRICING_CURRENCY_MISMATCH,
      httpStatus: 422,
      message: "The submitted currency does not match this market's configured currency.",
      details: { expected, received },
    }),

  invalidSaleAmount: () =>
    new AppError({
      code: ErrorCodes.PRICING_INVALID_SALE_AMOUNT,
      httpStatus: 422,
      message: "The sale amount must be lower than the regular amount.",
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.PRICING_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const inventoryErrors = {
  notFound: () =>
    new AppError({
      code: ErrorCodes.INVENTORY_NOT_FOUND,
      httpStatus: 404,
      message: "No stock record exists for this variant in this market.",
    }),

  alreadyExists: () =>
    new AppError({
      code: ErrorCodes.INVENTORY_ALREADY_EXISTS,
      httpStatus: 409,
      message: "A stock record already exists for this variant in this market.",
    }),

  insufficientStock: () =>
    new AppError({
      code: ErrorCodes.INVENTORY_INSUFFICIENT_STOCK,
      httpStatus: 409,
      message: "This operation would leave stock in an invalid state.",
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.INVENTORY_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const cartErrors = {
  itemNotFound: () =>
    new AppError({
      code: ErrorCodes.CART_ITEM_NOT_FOUND,
      httpStatus: 404,
      message: "This cart item does not exist.",
    }),

  variantUnavailable: () =>
    new AppError({
      code: ErrorCodes.CART_VARIANT_UNAVAILABLE,
      httpStatus: 422,
      message: "This product is not available for purchase in this market.",
    }),

  priceUnavailable: () =>
    new AppError({
      code: ErrorCodes.CART_PRICE_UNAVAILABLE,
      httpStatus: 422,
      message: "No price is configured for this product in this market.",
    }),

  insufficientStock: () =>
    new AppError({
      code: ErrorCodes.CART_INSUFFICIENT_STOCK,
      httpStatus: 409,
      message: "The requested quantity exceeds available stock.",
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.CART_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const wishlistErrors = {
  // Reuses catalogErrors.notFound("Product") for "doesn't exist/soft-deleted"
  // rather than a separate code — same reuse Cart already established for
  // its own "Variant not found" case.
  productUnavailable: () =>
    new AppError({
      code: ErrorCodes.WISHLIST_PRODUCT_UNAVAILABLE,
      httpStatus: 422,
      message: "This product is not available to be saved to your wishlist.",
    }),

  itemNotFound: () =>
    new AppError({
      code: ErrorCodes.WISHLIST_ITEM_NOT_FOUND,
      httpStatus: 404,
      message: "This item is not in your wishlist.",
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.WISHLIST_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const checkoutErrors = {
  cartNotFound: () =>
    new AppError({
      code: ErrorCodes.CHECKOUT_CART_NOT_FOUND,
      httpStatus: 404,
      message: "No cart exists for this market.",
    }),

  cartEmpty: () =>
    new AppError({
      code: ErrorCodes.CHECKOUT_CART_EMPTY,
      httpStatus: 422,
      message: "This cart has no items to check out.",
    }),

  cartAlreadyConverted: () =>
    new AppError({
      code: ErrorCodes.CHECKOUT_CART_ALREADY_CONVERTED,
      httpStatus: 409,
      message: "This cart has already been checked out.",
    }),

  couponUnsupported: () =>
    new AppError({
      code: ErrorCodes.CHECKOUT_COUPON_UNSUPPORTED,
      httpStatus: 422,
      message: "Coupons are not supported yet.",
    }),

  paymentMethodUnsupported: (method: string) =>
    new AppError({
      code: ErrorCodes.CHECKOUT_PAYMENT_METHOD_UNSUPPORTED,
      httpStatus: 422,
      message: "This payment method is not supported yet.",
      details: { method },
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.CHECKOUT_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const ordersErrors = {
  // Also used when a caller owns/permits a read but the row simply doesn't
  // exist, AND when an owner-or-permission check fails — a customer must
  // never be able to distinguish "not yours" from "doesn't exist" (same
  // posture as catalogErrors.notFound for a non-ACTIVE product).
  notFound: () =>
    new AppError({
      code: ErrorCodes.ORDERS_NOT_FOUND,
      httpStatus: 404,
      message: "Order not found.",
    }),

  invalidStatusTransition: (from: string, to: string) =>
    new AppError({
      code: ErrorCodes.ORDERS_INVALID_STATUS_TRANSITION,
      httpStatus: 422,
      message: `Cannot transition an order from ${from} to ${to}.`,
      details: { from, to },
    }),

  terminalState: (status: string) =>
    new AppError({
      code: ErrorCodes.ORDERS_TERMINAL_STATE,
      httpStatus: 422,
      message: `Order is in a terminal state (${status}) and cannot be transitioned.`,
      details: { status },
    }),

  statusConflict: () =>
    new AppError({
      code: ErrorCodes.ORDERS_STATUS_CONFLICT,
      httpStatus: 409,
      message: "The order was already transitioned by another request. Refetch and retry.",
    }),

  // Shared eligibility gate (orderMutability.helper.ts) — thrown by the edit
  // path. Same underlying condition as notDeletable() below, distinct
  // codes/messages so the frontend can show "can't edit" vs "can't delete"
  // copy even though the gate logic is one function.
  notEditable: () =>
    new AppError({
      code: ErrorCodes.ORDERS_NOT_EDITABLE,
      httpStatus: 409,
      message: "This order can no longer be edited: a payment or shipment has moved past PENDING, or a return exists.",
    }),

  notDeletable: () =>
    new AppError({
      code: ErrorCodes.ORDERS_NOT_DELETABLE,
      httpStatus: 409,
      message: "This order can no longer be deleted: a payment or shipment has moved past PENDING, or a return exists.",
    }),

  lineNotFound: (itemId: string) =>
    new AppError({
      code: ErrorCodes.ORDERS_LINE_NOT_FOUND,
      httpStatus: 404,
      message: `Order line ${itemId} not found on this order.`,
      details: { itemId },
    }),

  duplicateLineVariant: (variantId: string) =>
    new AppError({
      code: ErrorCodes.ORDERS_DUPLICATE_LINE_VARIANT,
      httpStatus: 422,
      message: "This order already has a line for that product variant — edit its quantity instead of adding a new line.",
      details: { variantId },
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.ORDERS_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const paymentsErrors = {
  // Same "never distinguish not-yours from doesn't-exist" posture as
  // ordersErrors.notFound.
  notFound: () =>
    new AppError({
      code: ErrorCodes.PAYMENTS_NOT_FOUND,
      httpStatus: 404,
      message: "Payment not found.",
    }),

  invalidStatusTransition: (from: string, to: string) =>
    new AppError({
      code: ErrorCodes.PAYMENTS_INVALID_STATUS_TRANSITION,
      httpStatus: 422,
      message: `Cannot transition a payment from ${from} to ${to}.`,
      details: { from, to },
    }),

  statusConflict: () =>
    new AppError({
      code: ErrorCodes.PAYMENTS_STATUS_CONFLICT,
      httpStatus: 409,
      message: "The payment was already updated by another request. Refetch and retry.",
    }),

  orderNotPayable: (orderStatus: string) =>
    new AppError({
      code: ErrorCodes.PAYMENTS_ORDER_NOT_PAYABLE,
      httpStatus: 422,
      message: `Order is in status ${orderStatus} and cannot accept a payment.`,
      details: { orderStatus },
    }),

  webhookSignatureInvalid: () =>
    new AppError({
      code: ErrorCodes.PAYMENTS_WEBHOOK_SIGNATURE_INVALID,
      httpStatus: 400,
      message: "Webhook signature verification failed.",
    }),

  webhookAmountMismatch: () =>
    new AppError({
      code: ErrorCodes.PAYMENTS_WEBHOOK_AMOUNT_MISMATCH,
      httpStatus: 422,
      message: "Webhook event amount/currency does not match the recorded payment.",
    }),

  webhookOrderMismatch: () =>
    new AppError({
      code: ErrorCodes.PAYMENTS_WEBHOOK_ORDER_MISMATCH,
      httpStatus: 422,
      message: "The order for this payment is no longer payable.",
    }),

  refundExceedsCaptured: () =>
    new AppError({
      code: ErrorCodes.PAYMENTS_REFUND_EXCEEDS_CAPTURED,
      httpStatus: 422,
      message: "Refund amount exceeds the captured payment amount.",
    }),

  unsupportedProvider: (provider: string) =>
    new AppError({
      code: ErrorCodes.PAYMENTS_UNSUPPORTED_PROVIDER,
      httpStatus: 400,
      message: `Unsupported payment provider: ${provider}.`,
      details: { provider },
    }),

  providerOperationUnsupported: (provider: string, operation: string) =>
    new AppError({
      code: ErrorCodes.PAYMENTS_PROVIDER_OPERATION_UNSUPPORTED,
      httpStatus: 422,
      message: `Provider ${provider} does not support ${operation}.`,
      details: { provider, operation },
    }),

  staffActionNotSupported: (provider: string) =>
    new AppError({
      code: ErrorCodes.PAYMENTS_STAFF_ACTION_UNSUPPORTED,
      httpStatus: 422,
      message: `This action is not supported for provider ${provider}.`,
      details: { provider },
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.PAYMENTS_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const shippingErrors = {
  methodNotFound: () =>
    new AppError({
      code: ErrorCodes.SHIPPING_METHOD_NOT_FOUND,
      httpStatus: 404,
      message: "Shipping method not found.",
    }),

  // Thrown by Checkout when the submitted shippingMethodId doesn't resolve
  // to an active method in the requested market — distinct from
  // methodNotFound (admin lookup by id) so a customer gets an honest,
  // market-scoped rejection rather than a bare 404.
  methodUnsupported: (shippingMethodId: string) =>
    new AppError({
      code: ErrorCodes.SHIPPING_METHOD_UNSUPPORTED,
      httpStatus: 422,
      message: "This shipping method is not available for the selected market.",
      details: { shippingMethodId },
    }),

  shipmentNotFound: () =>
    new AppError({
      code: ErrorCodes.SHIPMENT_NOT_FOUND,
      httpStatus: 404,
      message: "Shipment not found.",
    }),

  invalidStatusTransition: (from: string, to: string) =>
    new AppError({
      code: ErrorCodes.SHIPMENT_INVALID_STATUS_TRANSITION,
      httpStatus: 422,
      message: `Cannot transition a shipment from ${from} to ${to}.`,
      details: { from, to },
    }),

  statusConflict: () =>
    new AppError({
      code: ErrorCodes.SHIPMENT_STATUS_CONFLICT,
      httpStatus: 409,
      message: "The shipment was already updated by another request. Refetch and retry.",
    }),

  // Mirrors paymentsErrors.orderNotPayable (Phase 4L) — rejects a shipment
  // status update when the parent Order is already terminal.
  orderNotShippable: (orderStatus: string) =>
    new AppError({
      code: ErrorCodes.SHIPMENT_ORDER_NOT_SHIPPABLE,
      httpStatus: 422,
      message: `Order is in status ${orderStatus} and cannot accept a shipment update.`,
      details: { orderStatus },
    }),

  // ITEM_RETURNED/ITEM_LOST only make sense once the order is actually
  // cancelled — they record what happened to an already-dispatched
  // shipment after the fact, not a normal fulfillment outcome.
  itemOutcomeRequiresCancelledOrder: (orderStatus: string) =>
    new AppError({
      code: ErrorCodes.SHIPMENT_ITEM_OUTCOME_REQUIRES_CANCELLED_ORDER,
      httpStatus: 422,
      message: `Order is in status ${orderStatus}; ITEM_RETURNED/ITEM_LOST can only be recorded once the order is cancelled.`,
      details: { orderStatus },
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.SHIPPING_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const returnsErrors = {
  // Same "never distinguish not-yours from doesn't-exist" posture as
  // ordersErrors.notFound/paymentsErrors.notFound.
  notFound: () =>
    new AppError({
      code: ErrorCodes.RETURNS_NOT_FOUND,
      httpStatus: 404,
      message: "Return not found.",
    }),

  orderNotReturnable: (orderStatus: string) =>
    new AppError({
      code: ErrorCodes.RETURNS_ORDER_NOT_RETURNABLE,
      httpStatus: 422,
      message: `Order is in status ${orderStatus} and is not eligible for a return.`,
      details: { orderStatus },
    }),

  quantityExceedsAvailable: (orderItemId: string) =>
    new AppError({
      code: ErrorCodes.RETURNS_QUANTITY_EXCEEDS_AVAILABLE,
      httpStatus: 422,
      message: "Requested return quantity exceeds what remains returnable for this item.",
      details: { orderItemId },
    }),

  alreadyOpen: () =>
    new AppError({
      code: ErrorCodes.RETURNS_ALREADY_OPEN,
      httpStatus: 409,
      message: "This order already has an open return request.",
    }),

  invalidStatusTransition: (from: string, to: string) =>
    new AppError({
      code: ErrorCodes.RETURNS_INVALID_STATUS_TRANSITION,
      httpStatus: 422,
      message: `Cannot transition a return from ${from} to ${to}.`,
      details: { from, to },
    }),

  statusConflict: () =>
    new AppError({
      code: ErrorCodes.RETURNS_STATUS_CONFLICT,
      httpStatus: 409,
      message: "The return was already updated by another request. Refetch and retry.",
    }),

  paymentNotFound: () =>
    new AppError({
      code: ErrorCodes.RETURNS_PAYMENT_NOT_FOUND,
      httpStatus: 422,
      message: "No refundable payment exists for this order.",
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.RETURNS_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const reviewsErrors = {
  // Same "never distinguish not-yours from doesn't-exist" posture as
  // returnsErrors.notFound — used for both "doesn't exist" and "exists but
  // isn't yours" (ownership mismatch on updateOwn/deleteOwn).
  notFound: () =>
    new AppError({
      code: ErrorCodes.REVIEWS_NOT_FOUND,
      httpStatus: 404,
      message: "Review not found.",
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.REVIEWS_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const usersErrors = {
  notFound: () =>
    new AppError({
      code: ErrorCodes.USERS_NOT_FOUND,
      httpStatus: 404,
      message: "User not found.",
    }),

  // Self-role-change and self-suspend are both blocked unconditionally —
  // never trust the frontend to hide the control (docs/RBAC.md).
  cannotModifySelf: () =>
    new AppError({
      code: ErrorCodes.USERS_CANNOT_MODIFY_SELF,
      httpStatus: 409,
      message: "You cannot change your own role or account status.",
    }),

  // RbacService.canRemoveSuperAdmin / countActiveSuperAdminAssignments both
  // funnel into this — the server-side, unconditional "never zero admins" guard.
  lastSuperAdmin: () =>
    new AppError({
      code: ErrorCodes.USERS_LAST_SUPER_ADMIN,
      httpStatus: 409,
      message: "This is the last active super_admin — this action would leave the store with no administrators.",
    }),

  invalidStatusTransition: (from: string, to: string) =>
    new AppError({
      code: ErrorCodes.USERS_INVALID_STATUS_TRANSITION,
      httpStatus: 422,
      message: `Cannot transition a user from ${from} to ${to}.`,
      details: { from, to },
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.USERS_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),

  // Admin-created-customer only — a staff-facing form, not the public
  // registration endpoint, so the anti-enumeration posture register() uses
  // does not apply here: telling an admin the email is taken is expected UX.
  emailAlreadyExists: () =>
    new AppError({
      code: ErrorCodes.USERS_EMAIL_ALREADY_EXISTS,
      httpStatus: 409,
      message: "An account with this email already exists.",
    }),
};

export const contactErrors = {
  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.CONTACT_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),

  sendFailed: (logContext?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.CONTACT_SEND_FAILED,
      httpStatus: 502,
      message: "We couldn't send your message right now. Please try again later.",
      logContext,
    }),
};

export const marketsErrors = {
  notFound: () =>
    new AppError({
      code: ErrorCodes.MARKETS_NOT_FOUND,
      httpStatus: 404,
      message: "Market not found.",
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.MARKETS_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};

export const promotionsErrors = {
  notFound: () =>
    new AppError({
      code: ErrorCodes.PROMOTIONS_NOT_FOUND,
      httpStatus: 404,
      message: "Promotion not found.",
    }),

  invalidTarget: () =>
    new AppError({
      code: ErrorCodes.PROMOTIONS_INVALID_TARGET,
      httpStatus: 422,
      message: "targetProductId/targetCategoryId must match the selected targetType, and only one may be set.",
    }),

  invalidDateRange: () =>
    new AppError({
      code: ErrorCodes.PROMOTIONS_INVALID_DATE_RANGE,
      httpStatus: 422,
      message: "startAt must be before endAt.",
    }),

  validation: (details?: ErrorDetails) =>
    new AppError({
      code: ErrorCodes.PROMOTIONS_VALIDATION_ERROR,
      httpStatus: 400,
      message: "The submitted data is invalid.",
      details,
    }),
};
