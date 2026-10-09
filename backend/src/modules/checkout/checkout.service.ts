import type { Market, ShippingMethod } from "../../generated/prisma/client.js";
import { CheckoutRepository, type OrderLineInput } from "./checkout.repository.js";
import { toOrderView, type OrderView } from "./checkout.mapper.js";
import { CartRepository, type CartWithItems } from "../cart/cart.repository.js";
import { PricingRepository } from "../pricing/pricing.repository.js";
import { resolveEffectivePrice } from "../pricing/pricing.service.js";
import { InventoryRepository, InsufficientStockError } from "../inventory/inventory.repository.js";
import { ShippingMethodsRepository } from "../shipping/shipping-methods.repository.js";
import { catalogErrors, cartErrors, checkoutErrors, shippingErrors } from "../../errors/AppError.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";
import { env } from "../../config/env.js";
import type { CheckoutInput } from "./checkout.validators.js";
import { sendOrderConfirmation } from "../orders/orderConfirmation.helper.js";
import { computeSubtotal } from "../orders/orderTotals.helper.js";
import { notifyAdmins } from "../notifications/notifications.helper.js";

// "MOCK" is a test/dev-only payment provider (see
// modules/payments/providers/mock.provider.ts) that exists purely to
// exercise the Payments webhook-security machinery — never a real,
// customer-facing payment method, so it's excluded outright in production.
// The actual enforcement point for MOCK is providers/index.ts's
// resolveProvider(); this check is Checkout's own belt-and-suspenders copy
// so an unsupported method is rejected as early as possible.
const ALLOWED_PAYMENT_METHODS = env.isProduction ? ["COD"] : ["COD", "MOCK"];

export interface CheckoutResult {
  order: OrderView;
  /// True when this request replayed an already-completed checkout
  /// (identical Idempotency-Key) rather than creating anything new — the
  /// controller uses this to choose 200 vs 201.
  isReplay: boolean;
}

export class CheckoutService {
  constructor(
    private readonly checkoutRepository: CheckoutRepository = new CheckoutRepository(),
    private readonly cartRepository: CartRepository = new CartRepository(),
    private readonly pricingRepository: PricingRepository = new PricingRepository(),
    private readonly inventoryRepository: InventoryRepository = new InventoryRepository(),
    private readonly shippingMethodsRepository: ShippingMethodsRepository = new ShippingMethodsRepository(),
  ) {}

  async checkout(
    userId: string,
    marketCode: string,
    idempotencyKey: string,
    input: CheckoutInput,
  ): Promise<CheckoutResult> {
    // Idempotency replay — checked first, before any validation/reservation
    // work, so a retry of an already-completed checkout costs nothing.
    const existing = await this.checkoutRepository.findOrderByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (existing.userId !== userId) throw checkoutErrors.validation({ reason: "idempotency key already in use" });
      return { order: toOrderView(existing), isReplay: true };
    }

    const market = await this.resolveActiveMarket(marketCode);
    const cart = await this.cartRepository.findCartWithItems(userId, market.id);
    if (!cart) throw checkoutErrors.cartNotFound();
    if (cart.status !== "ACTIVE") throw checkoutErrors.cartAlreadyConverted();
    if (cart.items.length === 0) {
      // Cart's status and items are not guaranteed to be read in one atomic
      // round trip (see CheckoutRepository.findCartStatus) — a concurrent
      // checkout attempt can convert+clear this exact cart in the gap
      // between them. Re-check status fresh before concluding the cart is
      // genuinely empty, so that race surfaces as the correct
      // CHECKOUT_CART_ALREADY_CONVERTED rather than a misleading
      // CHECKOUT_CART_EMPTY.
      const freshStatus = await this.checkoutRepository.findCartStatus(cart.id);
      if (freshStatus !== "ACTIVE") throw checkoutErrors.cartAlreadyConverted();
      throw checkoutErrors.cartEmpty();
    }

    if (input.couponCode) throw checkoutErrors.couponUnsupported();
    if (!ALLOWED_PAYMENT_METHODS.includes(input.paymentMethod)) {
      throw checkoutErrors.paymentMethodUnsupported(input.paymentMethod);
    }

    const lines = await this.buildAndValidateLines(cart, market);
    const subtotalAmount = computeSubtotal(lines);
    const shippingMethod = await this.resolveShippingMethod(input.shippingMethodId, market.id);
    const shippingAmount = this.computeShippingAmount(shippingMethod, subtotalAmount);
    const totalAmount = subtotalAmount + shippingAmount; // discount/tax are always 0 this phase

    // shipToDifferentAddress=false means the customer didn't provide a
    // distinct shipping address — the billing address is used for both.
    const shippingAddress = input.shipToDifferentAddress ? input.shippingAddress! : input.billingAddress;

    const reference = `checkout:${idempotencyKey}`;
    const reservedStockIds = await this.reserveAll(lines, market.id, reference);

    let created;
    try {
      created = await this.checkoutRepository.convertCartAndCreateOrder({
        cartId: cart.id,
        userId,
        marketId: market.id,
        currencyCode: market.currencyCode,
        idempotencyKey,
        paymentMethod: input.paymentMethod,
        subtotalAmount,
        shippingAmount,
        totalAmount,
        lines,
        billingAddress: input.billingAddress,
        shippingAddress,
        shippingMethodId: shippingMethod.id,
      });
    } catch (error) {
      // A genuinely simultaneous request with the identical idempotency key
      // won this race — its reservations (made under the same shared
      // reference) legitimately back its order, so nothing is released here.
      if (isUniqueConstraintViolation(error, "idempotencyKey")) {
        const winning = await this.checkoutRepository.findOrderByIdempotencyKey(idempotencyKey);
        if (winning) return { order: toOrderView(winning), isReplay: true };
      }
      await this.releaseAll(reservedStockIds, reference);
      throw error;
    }

    if (!created) {
      // The guarded cart-status UPDATE affected 0 rows: some other request
      // converted this cart first. If that request carried the IDENTICAL
      // idempotency key, its reservations were made under this exact same
      // shared reference and now legitimately back its (already-committed)
      // order — releasing here would corrupt that order's stock. Check for
      // that case before treating this as a genuine loss.
      const winning = await this.checkoutRepository.findOrderByIdempotencyKey(idempotencyKey);
      if (winning) return { order: toOrderView(winning), isReplay: true };

      // A genuinely different checkout attempt (a different idempotency
      // key) converted this cart first. This attempt's reservations are
      // its own — release them, nothing to hand off to anyone.
      await this.releaseAll(reservedStockIds, reference);
      throw checkoutErrors.cartAlreadyConverted();
    }

    // Fire-and-forget on the genuine first-creation path only — a replay of
    // this same idempotency key (both early-return branches above) must
    // never trigger a second email or a duplicate notification.
    await sendOrderConfirmation({
      to: created.user.email,
      firstName: created.user.firstName,
      orderNumber: created.orderNumber,
      totalAmount: created.totalAmount,
      currencyCode: created.currencyCode,
    });
    await notifyAdmins({
      type: "ORDER_PLACED",
      title: "New order placed",
      message: `Order ${created.orderNumber} was placed by ${created.user.firstName}.`,
      entityType: "Order",
      entityId: created.id,
      requiredPermission: "orders:read",
    });

    return { order: toOrderView(created), isReplay: false };
  }

  // -- Shared guards --------------------------------------------------------

  /// An inactive/unknown market is a closed business boundary and behaves
  /// as "not found" — same rule Catalog/Pricing/Inventory/Cart apply.
  private async resolveActiveMarket(marketCode: string): Promise<Market> {
    const market = await this.checkoutRepository.findActiveMarketByCode(marketCode);
    if (!market) throw catalogErrors.notFound("Market");
    return market;
  }

  /// The submitted shippingMethodId must be active AND belong to this
  /// checkout's own market — a method from another market (or an archived
  /// one) is rejected with an honest, market-scoped error rather than a
  /// bare "not found" (see shippingErrors.methodUnsupported).
  private async resolveShippingMethod(shippingMethodId: string, marketId: string): Promise<ShippingMethod> {
    const method = await this.shippingMethodsRepository.findActiveByIdAndMarket(shippingMethodId, marketId);
    if (!method) throw shippingErrors.methodUnsupported(shippingMethodId);
    return method;
  }

  /// Server-computed, never client-supplied — the PRD's own shipping-cost
  /// formula (Market + Address + Order Value + Shipping Method -> Shipping
  /// Cost, §42) collapses to this for the MVP: free once the order's
  /// subtotal reaches the method's threshold, otherwise its flat baseRate.
  /// Address doesn't affect the amount (no zone-based rate table exists —
  /// see docs/modules/SHIPPING.md's ShippingZone deferral).
  private computeShippingAmount(method: ShippingMethod, subtotalAmount: number): number {
    if (method.freeShippingThreshold !== null && subtotalAmount >= method.freeShippingThreshold) {
      return 0;
    }
    return method.baseRate;
  }

  /// Re-validates every cart line against CURRENT catalog/price state —
  /// Cart's own prior validation (at add-to-cart time) is never trusted as
  /// a guarantee. Reuses Cart's exact business rules and error codes
  /// (CART_VARIANT_UNAVAILABLE/CART_PRICE_UNAVAILABLE) since this is the
  /// identical check, not a new business rule — the same "reuse, don't
  /// duplicate" precedent Pricing/Inventory established for CATALOG_NOT_FOUND.
  private async buildAndValidateLines(cart: CartWithItems, market: Market): Promise<OrderLineInput[]> {
    const lines: OrderLineInput[] = [];
    for (const item of cart.items) {
      const isCatalogActive = item.variant.status === "ACTIVE" && item.variant.product.status === "ACTIVE";
      if (!isCatalogActive) throw cartErrors.variantUnavailable();

      const productMarket = await this.cartRepository.findProductMarket(item.variant.productId, market.id);
      if (!productMarket?.isAvailable) throw cartErrors.variantUnavailable();

      const price = await this.pricingRepository.findPrice(item.variantId, market.id);
      if (!price || !price.isActive) throw cartErrors.priceUnavailable();
      const effective = resolveEffectivePrice(price);

      lines.push({
        variantId: item.variantId,
        productId: item.variant.productId,
        sku: item.variant.sku,
        productName: item.variant.product.name,
        variantName: item.variant.title,
        unitAmount: effective.effectiveAmount,
        quantity: item.quantity,
        lineTotal: effective.effectiveAmount * item.quantity,
        currencyCode: effective.currencyCode,
      });
    }
    return lines;
  }

  /// Phase A of the two-phase checkout (see docs/modules/CHECKOUT.md).
  /// Inventory's reserve() is atomic and idempotent per (stockId,
  /// reference) but opens its own internal transaction, so it cannot be
  /// nested inside Checkout's own order-creation transaction — this loop
  /// calls it as the standalone primitive it was designed to be. If any
  /// line fails (insufficient stock), every line already reserved in this
  /// same attempt is compensated (released) before the failure propagates,
  /// so a failed checkout leaves no partial reservation behind.
  private async reserveAll(lines: OrderLineInput[], marketId: string, reference: string): Promise<string[]> {
    const reservedStockIds: string[] = [];
    try {
      for (const line of lines) {
        const stock = await this.inventoryRepository.findByVariantAndMarket(line.variantId, marketId);
        if (!stock) throw new InsufficientStockError();
        await this.inventoryRepository.reserve(stock.id, line.quantity, reference);
        reservedStockIds.push(stock.id);
      }
      return reservedStockIds;
    } catch (error) {
      await this.releaseAll(reservedStockIds, reference);
      if (error instanceof InsufficientStockError) throw cartErrors.insufficientStock();
      throw error;
    }
  }

  /// Best-effort compensation. release() is itself idempotent (a no-op if
  /// nothing ACTIVE exists for the reference), so this is safe to call on
  /// stock ids that may already have been released by a prior attempt.
  private async releaseAll(stockIds: string[], reference: string): Promise<void> {
    for (const stockId of stockIds) {
      await this.inventoryRepository.release(stockId, reference);
    }
  }
}
