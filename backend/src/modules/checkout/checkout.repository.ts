import type { Market, Order, OrderAddress, OrderItem, PrismaClient } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";
import type { ShippingAddressInput } from "./checkout.validators.js";
import { generateOrderNumber } from "../orders/orderNumber.js";

export type OrderWithDetails = Order & {
  items: OrderItem[];
  addresses: OrderAddress[];
  market: Market;
  user: { email: string; firstName: string };
};

// `user` (email/firstName only) is included so the service layer can send
// the order-confirmation email without a second round trip.
const orderWithDetailsInclude = {
  items: true,
  addresses: true,
  market: true,
  user: { select: { email: true, firstName: true } },
};

export interface OrderLineInput {
  variantId: string;
  productId: string;
  sku: string;
  productName: string;
  variantName: string;
  unitAmount: number;
  quantity: number;
  lineTotal: number;
  currencyCode: string;
}

export interface CreateOrderParams {
  cartId: string;
  userId: string;
  marketId: string;
  currencyCode: string;
  idempotencyKey: string;
  paymentMethod: string;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  lines: OrderLineInput[];
  billingAddress: ShippingAddressInput;
  shippingAddress: ShippingAddressInput;
  shippingMethodId: string;
}

export class CheckoutRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  /// Direct read against the shared `markets` table — the same duplicated
  /// pattern Pricing/Inventory/Cart each already carry (no Markets service
  /// exists yet).
  async findActiveMarketByCode(code: string): Promise<Market | null> {
    return this.prisma.market.findFirst({ where: { code, isActive: true } });
  }

  // `user` is cast non-null below: Order.user is optional at the schema
  // level (to support guest/no-account admin orders — see orders module),
  // but Checkout exclusively creates ONLINE orders with a mandatory,
  // real userId, so this repository's own `user` is never actually null.
  async findOrderByIdempotencyKey(idempotencyKey: string): Promise<OrderWithDetails | null> {
    const order = await this.prisma.order.findUnique({ where: { idempotencyKey }, include: orderWithDetailsInclude });
    return order as OrderWithDetails | null;
  }

  /// A single-field, single-round-trip read used only to close a torn-read
  /// race: `CartRepository.findCartWithItems` reads a cart's `status` and
  /// its `items` relation, which under this project's Prisma 7 +
  /// `@prisma/adapter-pg` transport is not guaranteed to be one atomic
  /// round trip. If a concurrent checkout attempt converts and clears the
  /// same cart in the gap between those two reads, a caller could observe
  /// `status: 'ACTIVE'` (read before the commit) together with `items: []`
  /// (read after it) — a real race reproduced under load in this phase's
  /// own concurrency tests. checkout.service.ts re-checks status via this
  /// method before concluding a cart is genuinely empty.
  async findCartStatus(cartId: string): Promise<string | null> {
    const cart = await this.prisma.cart.findUnique({ where: { id: cartId }, select: { status: true } });
    return cart?.status ?? null;
  }

  /// The single transactional commit point of checkout. Inventory
  /// reservation happens BEFORE this is called (see checkout.service.ts —
  /// Inventory's reserve/release each open their own internal transaction
  /// and cannot be nested here; docs/modules/CHECKOUT.md documents the
  /// two-phase design in full).
  ///
  /// The guarded `UPDATE ... WHERE status = 'ACTIVE'` is a single atomic
  /// statement — the same "guarded conditional UPDATE, no row lock needed"
  /// pattern Inventory's own guarded updates use. Returns `null` (rather
  /// than throwing) when it affects 0 rows, meaning a concurrent checkout
  /// attempt already converted this cart — the caller (service layer)
  /// decides what that means (release this attempt's reservations, throw
  /// CHECKOUT_CART_ALREADY_CONVERTED).
  // See findOrderByIdempotencyKey's comment on the `user` non-null cast.
  async convertCartAndCreateOrder(params: CreateOrderParams): Promise<OrderWithDetails | null> {
    return this.prisma.$transaction(async (tx): Promise<OrderWithDetails | null> => {
      const guarded = await tx.$queryRaw<{ id: string }[]>`
        UPDATE carts SET status = 'CONVERTED', "updatedAt" = now()
        WHERE id = ${params.cartId}::uuid AND status = 'ACTIVE'
        RETURNING id
      `;
      if (guarded.length === 0) return null;

      const orderNumber = await generateOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: params.userId,
          marketId: params.marketId,
          currencyCode: params.currencyCode,
          paymentMethod: params.paymentMethod,
          subtotalAmount: params.subtotalAmount,
          shippingAmount: params.shippingAmount,
          totalAmount: params.totalAmount,
          idempotencyKey: params.idempotencyKey,
          items: {
            create: params.lines.map((line) => ({
              variantId: line.variantId,
              productId: line.productId,
              sku: line.sku,
              productName: line.productName,
              variantName: line.variantName,
              unitAmount: line.unitAmount,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
              currencyCode: line.currencyCode,
            })),
          },
          addresses: {
            create: [
              { type: "BILLING", ...params.billingAddress },
              { type: "SHIPPING", ...params.shippingAddress },
            ],
          },
        },
        include: orderWithDetailsInclude,
      });

      // Phase 4K (Payments): one Payment row per order, created here so the
      // PRD's own checkout transaction boundary ("Reserve inventory ->
      // Create payment -> COMMIT") is followed literally. No provider call
      // happens in this transaction — COD has none, and MOCK's confirmation
      // only ever arrives later via its signed webhook (see
      // docs/modules/PAYMENTS.md). Deriving the payment's idempotency key
      // from checkout's own key makes it replay-safe for free: one checkout
      // attempt produces at most one Payment row.
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: params.paymentMethod === "MOCK" ? "MOCK" : "COD",
          method: params.paymentMethod,
          status: "PENDING",
          amount: params.totalAmount,
          currencyCode: params.currencyCode,
          idempotencyKey: `payment:${params.idempotencyKey}`,
        },
      });

      // Phase 4M (Shipping): one Shipment row per order, created here
      // alongside Payment — the same "no standalone creation endpoint,
      // implicit at order-creation time" precedent, since the PRD names no
      // POST /shipments route. No provider call happens in this
      // transaction (ShippingProvider.dispatch is only ever invoked later,
      // on the staff-driven ->SHIPPED transition; see
      // docs/modules/SHIPPING.md).
      await tx.shipment.create({
        data: {
          orderId: order.id,
          shippingMethodId: params.shippingMethodId,
          status: "PENDING",
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: params.cartId } });

      return order as OrderWithDetails;
    });
  }
}
