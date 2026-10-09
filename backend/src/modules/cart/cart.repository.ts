import type {
  Cart,
  CartItem,
  Market,
  PrismaClient,
  Product,
  ProductMedia,
  ProductVariant,
} from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";

export type CartWithItems = Cart & {
  items: (CartItem & {
    variant: ProductVariant & { product: Product & { media: ProductMedia[] } };
  })[];
  market: Market;
};

export type VariantForCart = ProductVariant & {
  product: Product;
  marketAvailability: { isAvailable: boolean } | null;
};

const cartWithItemsInclude = {
  items: {
    include: {
      variant: {
        include: {
          product: {
            include: {
              media: {
                orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }],
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  market: true,
};

export class CartRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  /// Direct read against the shared `markets` table — the same duplicated
  /// pattern Pricing/Inventory each already carry (no Markets service
  /// exists yet). An inactive market is a closed business boundary and
  /// behaves as "not found", identical to their rule.
  async findActiveMarketByCode(code: string): Promise<Market | null> {
    return this.prisma.market.findFirst({ where: { code, isActive: true } });
  }

  /// Direct, read-only Catalog reads (ProductVariant/Product/ProductMarket)
  /// scoped to one market — the same "own repository does the read
  /// directly" precedent Pricing/Inventory established, rather than a
  /// cross-module service call. No Catalog file is touched by this query.
  async findVariantForCart(variantId: string, marketId: string): Promise<VariantForCart | null> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
      include: { product: true },
    });
    if (!variant || variant.product.deletedAt !== null) return null;

    const marketAvailability = await this.prisma.productMarket.findUnique({
      where: { productId_marketId: { productId: variant.productId, marketId } },
      select: { isAvailable: true },
    });

    return { ...variant, marketAvailability };
  }

  /// Used per-item when building a cart's read view (cart.service.ts). Cart
  /// sizes are small (a handful of lines), so a per-item lookup here — like
  /// the equivalent per-item Pricing/Inventory lookups — is a deliberate
  /// MVP-scale choice, not an oversight; batching would only be justified if
  /// carts grew large enough for it to matter.
  async findProductMarket(productId: string, marketId: string): Promise<{ isAvailable: boolean } | null> {
    return this.prisma.productMarket.findUnique({
      where: { productId_marketId: { productId, marketId } },
      select: { isAvailable: true },
    });
  }

  async findCartWithItems(userId: string, marketId: string): Promise<CartWithItems | null> {
    return this.prisma.cart.findUnique({
      where: { userId_marketId: { userId, marketId } },
      include: cartWithItemsInclude,
    });
  }

  async findCartWithItemsById(cartId: string): Promise<CartWithItems> {
    return this.prisma.cart.findUniqueOrThrow({ where: { id: cartId }, include: cartWithItemsInclude });
  }

  /// Not `prisma.cart.upsert` — for the same reason PricingRepository's
  /// upsertPrice isn't: under this project's Prisma 7 + `@prisma/adapter-pg`
  /// transport, `upsert` is emulated client-side (try create, fall back to
  /// update), so two genuinely concurrent "get or create" calls can each
  /// attempt "create" and one would surface a raw conflict. Handling it
  /// explicitly here — try create, and on a unique-constraint collision fall
  /// back to reading the row a concurrent request just created — resolves
  /// the "concurrent cart creation" race with exactly one row surviving.
  ///
  /// (Phase 4I) `@@unique([userId, marketId])` permits at most one Cart row
  /// ever per user+market, so once Checkout converts a cart there is no
  /// second row to create for that user's next shopping trip in this
  /// market. Rather than a schema change, a non-ACTIVE row found here
  /// (CONVERTED by Checkout, or a hypothetical future ABANDONED) is simply
  /// reactivated in place — its items are already empty (Checkout clears
  /// them as part of conversion), so reactivation is just a status flip.
  /// This is the smallest schema-compatible fix to the limitation flagged
  /// in Phase 4H's CURRENT_TASK.md, and was pre-authorized there.
  async getOrCreateCart(userId: string, marketId: string): Promise<Cart> {
    const existing = await this.prisma.cart.findUnique({ where: { userId_marketId: { userId, marketId } } });
    if (existing) {
      if (existing.status === "ACTIVE") return existing;
      return this.prisma.cart.update({ where: { id: existing.id }, data: { status: "ACTIVE" } });
    }

    try {
      return await this.prisma.cart.create({ data: { userId, marketId } });
    } catch (error) {
      if (!isUniqueConstraintViolation(error, "userId")) throw error;
      const raced = await this.prisma.cart.findUniqueOrThrow({ where: { userId_marketId: { userId, marketId } } });
      if (raced.status === "ACTIVE") return raced;
      return this.prisma.cart.update({ where: { id: raced.id }, data: { status: "ACTIVE" } });
    }
  }

  async findCartItem(cartId: string, itemId: string): Promise<CartItem | null> {
    return this.prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
  }

  /// Adds `quantity` for a variant not yet in the cart, or increments the
  /// existing line by `quantity` if it is — the "duplicate add" / "add the
  /// same variant twice" behavior. Guarded against the identical concurrent
  /// race PricingRepository.upsertPrice guards: two simultaneous first-adds
  /// of the same variant can both attempt "create"; the loser falls back to
  /// an atomic increment instead of surfacing a raw conflict, and no
  /// quantity is lost.
  async addOrIncrementItem(cartId: string, variantId: string, quantity: number): Promise<CartItem> {
    try {
      return await this.prisma.cartItem.create({ data: { cartId, variantId, quantity } });
    } catch (error) {
      if (!isUniqueConstraintViolation(error, "cartId")) throw error;
      const rows = await this.prisma.$queryRaw<CartItem[]>`
        UPDATE cart_items
        SET quantity = quantity + ${quantity}, "updatedAt" = now()
        WHERE "cartId" = ${cartId}::uuid AND "variantId" = ${variantId}::uuid
        RETURNING *
      `;
      return rows[0]!;
    }
  }

  async setItemQuantity(itemId: string, quantity: number): Promise<CartItem> {
    return this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  }

  /// Scoped to `cartId` as well as `itemId` so a caller can never remove an
  /// item from a cart they don't own by guessing another user's item id —
  /// ownership is enforced by the query shape itself, not just a pre-check.
  async removeItem(cartId: string, itemId: string): Promise<boolean> {
    const result = await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
    return result.count > 0;
  }

  async clearItems(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
  }
}
