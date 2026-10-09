import { WishlistRepository, type AddableProduct, type WishlistWithItems } from "./wishlist.repository.js";
import { catalogErrors, wishlistErrors } from "../../errors/AppError.js";
import type { WishlistItemView, WishlistView } from "./wishlist.mapper.js";

export class WishlistService {
  constructor(private readonly wishlistRepository: WishlistRepository = new WishlistRepository()) {}

  async getWishlist(userId: string): Promise<WishlistView> {
    const wishlist = await this.wishlistRepository.getOrCreateWishlist(userId);
    const full = await this.wishlistRepository.findWishlistWithItemsById(wishlist.id);
    return this.buildView(full);
  }

  /// Adding an already-saved product is idempotent (no error) — the PRD's
  /// own uniqueness rule doubles as the duplicate-add contract, mirroring
  /// Cart's own "adding an already-present variant doesn't error" precedent.
  async addItem(userId: string, productId: string): Promise<WishlistView> {
    await this.assertAddable(productId);

    const wishlist = await this.wishlistRepository.getOrCreateWishlist(userId);
    await this.wishlistRepository.addItem(wishlist.id, productId);

    const refreshed = await this.wishlistRepository.findWishlistWithItemsById(wishlist.id);
    return this.buildView(refreshed);
  }

  async removeItem(userId: string, productId: string): Promise<void> {
    const wishlist = await this.wishlistRepository.findWishlistWithItems(userId);
    if (!wishlist) throw wishlistErrors.itemNotFound();

    const removed = await this.wishlistRepository.removeItem(wishlist.id, productId);
    if (!removed) throw wishlistErrors.itemNotFound();
  }

  // -- Shared guards --------------------------------------------------------

  /// Server-side validation that a product can be saved — never trusts the
  /// client's assertion that a productId is real/purchasable. A product a
  /// customer can see and click the heart on is already ACTIVE by
  /// construction; this guard only matters against a malicious/stale direct
  /// API call. Mirrors Cart's assertPurchasable, at product granularity.
  private async assertAddable(productId: string): Promise<AddableProduct> {
    const product = await this.wishlistRepository.findAddableProduct(productId);
    if (!product) throw catalogErrors.notFound("Product");
    if (product.status !== "ACTIVE") throw wishlistErrors.productUnavailable();
    return product;
  }

  private buildItemView(item: WishlistWithItems["items"][number]): WishlistItemView {
    const { product } = item;
    const isAvailable = product.status === "ACTIVE" && product.deletedAt === null;
    const primaryMedia = product.media.find((m) => m.isPrimary) ?? product.media[0] ?? null;
    const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0] ?? null;

    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: primaryMedia?.url ?? null,
      isAvailable,
      defaultVariantId: defaultVariant?.id ?? null,
      hasMultipleVariants: product.variants.length > 1,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private buildView(wishlist: WishlistWithItems): WishlistView {
    const items = wishlist.items.map((item) => this.buildItemView(item));
    return {
      id: wishlist.id,
      items,
      itemCount: items.length,
      createdAt: wishlist.createdAt.toISOString(),
      updatedAt: wishlist.updatedAt.toISOString(),
    };
  }
}
