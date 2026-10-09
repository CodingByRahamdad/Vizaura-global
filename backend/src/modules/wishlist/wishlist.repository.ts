import type {
  PrismaClient,
  Product,
  ProductMedia,
  ProductVariant,
  Wishlist,
  WishlistItem,
} from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";

export type AddableProduct = Product & { variants: ProductVariant[] };

export type WishlistWithItems = Wishlist & {
  items: (WishlistItem & {
    product: Product & { variants: ProductVariant[]; media: ProductMedia[] };
  })[];
};

const wishlistWithItemsInclude = {
  items: {
    include: {
      product: {
        include: {
          variants: { where: { deletedAt: null }, orderBy: { position: "asc" as const } },
          // Product-level media only (variantId: null) — same filter Catalog's
          // own productDetailInclude uses; picking "the" primary image is left
          // to the mapper/service, mirroring getProductCardData's own
          // `find(isPrimary) ?? [0]` fallback rather than assuming every
          // product has an explicitly flagged primary image.
          media: { where: { variantId: null }, orderBy: { position: "asc" as const } },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

export class WishlistRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  /// Direct, read-only Catalog read (Product + its variants) — the same "own
  /// repository does the read directly, no cross-module service call"
  /// precedent Cart/Pricing/Inventory each already established. No Catalog
  /// file is touched by this query.
  async findAddableProduct(productId: string): Promise<AddableProduct | null> {
    return this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: { variants: { where: { deletedAt: null }, orderBy: { position: "asc" } } },
    });
  }

  /// Same "try create, fall back to a concurrent-winner refetch" race guard
  /// as CartRepository.getOrCreateCart — two simultaneous first-time wishlist
  /// accesses for the same user resolve to exactly one row.
  async getOrCreateWishlist(userId: string): Promise<Wishlist> {
    const existing = await this.prisma.wishlist.findUnique({ where: { userId } });
    if (existing) return existing;

    try {
      return await this.prisma.wishlist.create({ data: { userId } });
    } catch (error) {
      if (!isUniqueConstraintViolation(error, "userId")) throw error;
      return this.prisma.wishlist.findUniqueOrThrow({ where: { userId } });
    }
  }

  async findWishlistWithItems(userId: string): Promise<WishlistWithItems | null> {
    return this.prisma.wishlist.findUnique({
      where: { userId },
      include: wishlistWithItemsInclude,
    });
  }

  async findWishlistWithItemsById(wishlistId: string): Promise<WishlistWithItems> {
    return this.prisma.wishlist.findUniqueOrThrow({
      where: { id: wishlistId },
      include: wishlistWithItemsInclude,
    });
  }

  /// Idempotent: a unique-constraint collision on (wishlistId, productId)
  /// means the product is already saved — treated as success, not an error.
  /// Unlike Cart's addOrIncrementItem there is no quantity to increment, so
  /// no raw SQL fallback is needed, just a no-op on collision.
  async addItem(wishlistId: string, productId: string): Promise<void> {
    try {
      await this.prisma.wishlistItem.create({ data: { wishlistId, productId } });
    } catch (error) {
      if (!isUniqueConstraintViolation(error, "wishlistId")) throw error;
    }
  }

  /// Scoped to wishlistId as well as productId so a caller can never remove
  /// another user's saved item by guessing a productId — ownership is
  /// enforced by the query shape itself, same as Cart's removeItem.
  async removeItem(wishlistId: string, productId: string): Promise<boolean> {
    const result = await this.prisma.wishlistItem.deleteMany({ where: { wishlistId, productId } });
    return result.count > 0;
  }
}
