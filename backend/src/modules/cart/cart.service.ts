import type { Market } from "../../generated/prisma/client.js";
import { CartRepository, type CartWithItems, type VariantForCart } from "./cart.repository.js";
import { PricingRepository } from "../pricing/pricing.repository.js";
import { resolveEffectivePrice } from "../pricing/pricing.service.js";
import { InventoryRepository } from "../inventory/inventory.repository.js";
import { catalogErrors, cartErrors } from "../../errors/AppError.js";
import type { CartItemView, CartView } from "./cart.mapper.js";

export class CartService {
  constructor(
    private readonly cartRepository: CartRepository = new CartRepository(),
    private readonly pricingRepository: PricingRepository = new PricingRepository(),
    private readonly inventoryRepository: InventoryRepository = new InventoryRepository(),
  ) {}

  async getCart(userId: string, marketCode: string): Promise<CartView> {
    const market = await this.resolveActiveMarket(marketCode);
    const cart = await this.cartRepository.getOrCreateCart(userId, market.id);
    const full = await this.cartRepository.findCartWithItemsById(cart.id);
    return this.buildView(full, market);
  }

  /// Adding the same variant twice increments its existing line rather than
  /// creating a second row (`@@unique([cartId, variantId])`) — the
  /// documented PRD/CART.md uniqueness rule, not an accidental side effect.
  async addItem(userId: string, marketCode: string, variantId: string, quantity: number): Promise<CartView> {
    const market = await this.resolveActiveMarket(marketCode);
    const variant = await this.assertPurchasable(variantId, market);

    const cart = await this.cartRepository.getOrCreateCart(userId, market.id);
    const existing = await this.cartRepository.findCartWithItemsById(cart.id);
    const existingQuantity = existing.items.find((item) => item.variantId === variantId)?.quantity ?? 0;

    await this.assertPriceAndStock(variant, market, existingQuantity + quantity);
    await this.cartRepository.addOrIncrementItem(cart.id, variantId, quantity);

    const refreshed = await this.cartRepository.findCartWithItemsById(cart.id);
    return this.buildView(refreshed, market);
  }

  /// Sets the line to an absolute quantity (unlike addItem, which is
  /// additive) — the documented PATCH semantics (CART.md/API_CONTRACTS.md).
  async updateItemQuantity(userId: string, marketCode: string, itemId: string, quantity: number): Promise<CartView> {
    const market = await this.resolveActiveMarket(marketCode);
    const cart = await this.cartRepository.findCartWithItems(userId, market.id);
    const item = cart?.items.find((candidate) => candidate.id === itemId);
    if (!cart || !item) throw cartErrors.itemNotFound();

    const variant = await this.assertPurchasable(item.variantId, market);
    await this.assertPriceAndStock(variant, market, quantity);
    await this.cartRepository.setItemQuantity(itemId, quantity);

    const refreshed = await this.cartRepository.findCartWithItemsById(cart.id);
    return this.buildView(refreshed, market);
  }

  async removeItem(userId: string, marketCode: string, itemId: string): Promise<void> {
    const market = await this.resolveActiveMarket(marketCode);
    const cart = await this.cartRepository.findCartWithItems(userId, market.id);
    if (!cart) throw cartErrors.itemNotFound();

    const removed = await this.cartRepository.removeItem(cart.id, itemId);
    if (!removed) throw cartErrors.itemNotFound();
  }

  /// Clears the cart's items but keeps the Cart row itself (market/status
  /// intact) — idempotent no-op if the customer has no cart yet in this
  /// market, matching this project's established idempotency convention
  /// (e.g. Inventory's release-with-nothing-active).
  async clearCart(userId: string, marketCode: string): Promise<void> {
    const market = await this.resolveActiveMarket(marketCode);
    const cart = await this.cartRepository.findCartWithItems(userId, market.id);
    if (!cart) return;
    await this.cartRepository.clearItems(cart.id);
  }

  // -- Shared guards --------------------------------------------------------

  /// An inactive/unknown market is a closed business boundary and behaves
  /// as "not found" — same rule Catalog/Pricing/Inventory apply.
  private async resolveActiveMarket(marketCode: string): Promise<Market> {
    const market = await this.cartRepository.findActiveMarketByCode(marketCode);
    if (!market) throw catalogErrors.notFound("Market");
    return market;
  }

  /// Server-side catalog/market validation for a variant a client wants to
  /// add or update in the cart — never trusts the client's assertion that a
  /// product/variant is buyable. Mirrors the exact checks CART.md documents
  /// (variant exists, product available, market available).
  private async assertPurchasable(variantId: string, market: Market): Promise<VariantForCart> {
    const variant = await this.cartRepository.findVariantForCart(variantId, market.id);
    if (!variant) throw catalogErrors.notFound("Variant");
    if (variant.status !== "ACTIVE" || variant.product.status !== "ACTIVE") {
      throw cartErrors.variantUnavailable();
    }
    if (!variant.marketAvailability?.isAvailable) throw cartErrors.variantUnavailable();
    return variant;
  }

  /// Price and stock are always re-read from Pricing/Inventory at the
  /// moment of the request — never trusted from the client and never cached
  /// on the cart row (docs/modules/CART.md's core security rule). This is a
  /// check only, not a reservation: Cart never decrements or reserves stock
  /// (that boundary belongs to a future Checkout phase — see
  /// docs/modules/INVENTORY.md's reservation-ownership note).
  private async assertPriceAndStock(variant: VariantForCart, market: Market, requestedQuantity: number): Promise<void> {
    const price = await this.pricingRepository.findPrice(variant.id, market.id);
    if (!price || !price.isActive) throw cartErrors.priceUnavailable();

    const stock = await this.inventoryRepository.findByVariantAndMarket(variant.id, market.id);
    const available = stock ? stock.onHand - stock.reserved : 0;
    if (requestedQuantity > available) throw cartErrors.insufficientStock();
  }

  private async buildItemView(item: CartWithItems["items"][number], market: Market): Promise<CartItemView> {
    const [price, stock, productMarket] = await Promise.all([
      this.pricingRepository.findPrice(item.variantId, market.id),
      this.inventoryRepository.findByVariantAndMarket(item.variantId, market.id),
      this.cartRepository.findProductMarket(item.variant.productId, market.id),
    ]);

    const isCatalogActive = item.variant.status === "ACTIVE" && item.variant.product.status === "ACTIVE";
    const isMarketAvailable = productMarket?.isAvailable ?? false;
    const hasActivePrice = price?.isActive ?? false;
    const isAvailable = isCatalogActive && isMarketAvailable && hasActivePrice;

    const effective = price ? resolveEffectivePrice(price) : null;
    const available = stock ? stock.onHand - stock.reserved : 0;

    const originalAmount = isAvailable && effective!.isOnSale ? effective!.amount : null;
    const discountPercent =
      originalAmount !== null
        ? Math.round(((originalAmount - effective!.effectiveAmount) / originalAmount) * 100)
        : null;

    return {
      id: item.id,
      variantId: item.variantId,
      sku: item.variant.sku,
      title: item.variant.title,
      productId: item.variant.productId,
      productSlug: item.variant.product.slug,
      productName: item.variant.product.name,
      variantTitle: item.variant.title,
      imageUrl: item.variant.product.media[0]?.url ?? null,
      quantity: item.quantity,
      unitAmount: isAvailable ? effective!.effectiveAmount : null,
      originalAmount,
      discountPercent,
      lineTotal: isAvailable ? effective!.effectiveAmount * item.quantity : null,
      isAvailable,
      isInStock: available >= item.quantity,
    };
  }

  private async buildView(cart: CartWithItems, market: Market): Promise<CartView> {
    const items = await Promise.all(cart.items.map((item) => this.buildItemView(item, market)));
    const subtotalAmount = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      id: cart.id,
      marketCode: cart.market.code,
      currencyCode: cart.market.currencyCode,
      status: cart.status,
      items,
      itemCount,
      subtotalAmount,
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
    };
  }
}
