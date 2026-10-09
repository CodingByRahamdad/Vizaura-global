import type { Market, VariantStock } from "../../generated/prisma/client.js";
import { InventoryRepository, InsufficientStockError, type AdminInventoryRow } from "./inventory.repository.js";
import { ProductsRepository } from "../catalog/products.repository.js";
import { VariantsRepository } from "../catalog/variants.repository.js";
import { catalogErrors, inventoryErrors } from "../../errors/AppError.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";
import type {
  AdjustStockInput,
  CreateStockInput,
  ReceiveStockInput,
  ReserveStockInput,
} from "./inventory.validators.js";

export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository = new InventoryRepository(),
    private readonly productsRepository: ProductsRepository = new ProductsRepository(),
    private readonly variantsRepository: VariantsRepository = new VariantsRepository(),
  ) {}

  async createStock(
    productId: string,
    variantId: string,
    input: CreateStockInput,
  ): Promise<VariantStock & { market: Market }> {
    await this.assertVariantExists(productId, variantId);
    const market = await this.resolveActiveMarket(input.marketCode);

    try {
      const stock = await this.inventoryRepository.create(variantId, market.id, input.onHand ?? 0);
      return { ...stock, market };
    } catch (error) {
      if (isUniqueConstraintViolation(error, "variantId")) throw inventoryErrors.alreadyExists();
      throw error;
    }
  }

  async receiveStock(
    productId: string,
    variantId: string,
    marketCode: string,
    input: ReceiveStockInput,
    userId: string | undefined,
  ): Promise<VariantStock & { market: Market }> {
    const { stock, market } = await this.getStockOrThrow(productId, variantId, marketCode);
    const updated = await this.inventoryRepository.receive(stock.id, input.quantity, input.reason, userId);
    return { ...updated, market };
  }

  async adjustStock(
    productId: string,
    variantId: string,
    marketCode: string,
    input: AdjustStockInput,
    userId: string | undefined,
  ): Promise<VariantStock & { market: Market }> {
    const { stock, market } = await this.getStockOrThrow(productId, variantId, marketCode);
    try {
      const updated = await this.inventoryRepository.adjust(stock.id, input.delta, input.reason, userId);
      return { ...updated, market };
    } catch (error) {
      if (error instanceof InsufficientStockError) throw inventoryErrors.insufficientStock();
      throw error;
    }
  }

  async reserveStock(
    productId: string,
    variantId: string,
    marketCode: string,
    input: ReserveStockInput,
  ): Promise<VariantStock & { market: Market }> {
    const { stock, market } = await this.getStockOrThrow(productId, variantId, marketCode);
    try {
      const updated = await this.inventoryRepository.reserve(stock.id, input.quantity, input.reference);
      return { ...updated, market };
    } catch (error) {
      if (error instanceof InsufficientStockError) throw inventoryErrors.insufficientStock();
      throw error;
    }
  }

  async releaseStock(productId: string, variantId: string, marketCode: string, reference: string): Promise<void> {
    const { stock } = await this.getStockOrThrow(productId, variantId, marketCode);
    await this.inventoryRepository.release(stock.id, reference);
  }

  async getStock(
    productId: string,
    variantId: string,
    marketCode: string,
    canSeeAllStatuses: boolean,
  ): Promise<VariantStock & { market: Market }> {
    await this.assertVariantVisible(productId, variantId, canSeeAllStatuses);
    const market = await this.resolveActiveMarket(marketCode);
    const stock = await this.inventoryRepository.findByVariantAndMarket(variantId, market.id);
    if (!stock) throw inventoryErrors.notFound();
    return { ...stock, market };
  }

  async listStock(
    productId: string,
    variantId: string,
    canSeeAllStatuses: boolean,
  ): Promise<(VariantStock & { market: Market })[]> {
    await this.assertVariantVisible(productId, variantId, canSeeAllStatuses);
    return this.inventoryRepository.findAllByVariant(variantId);
  }

  /// Admin cross-catalog list (Phase 6E) — gated inventory:read at the
  /// route, no product-visibility widening rule to apply (unlike
  /// getStock/listStock, which serve a dual public/admin purpose).
  async listForAdmin(
    filter: { search?: string; marketCode?: string },
    pagination: { skip: number; take: number },
  ): Promise<{ rows: AdminInventoryRow[]; total: number }> {
    return this.inventoryRepository.listForAdmin({ ...filter, ...pagination });
  }

  // -- Shared guards --------------------------------------------------------

  private async getStockOrThrow(
    productId: string,
    variantId: string,
    marketCode: string,
  ): Promise<{ stock: VariantStock; market: Market }> {
    await this.assertVariantExists(productId, variantId);
    const market = await this.resolveActiveMarket(marketCode);
    const stock = await this.inventoryRepository.findByVariantAndMarket(variantId, market.id);
    if (!stock) throw inventoryErrors.notFound();
    return { stock, market };
  }

  private async assertVariantExists(productId: string, variantId: string): Promise<void> {
    const variant = await this.variantsRepository.findVariantByProductAndId(productId, variantId);
    if (!variant) throw catalogErrors.notFound("Variant");
  }

  /// Draft/archived products' variants are only visible to a caller who can
  /// see the product itself — identical rule to Catalog's
  /// VariantsService.listVariants and Pricing's equivalent guard.
  private async assertVariantVisible(productId: string, variantId: string, canSeeAllStatuses: boolean): Promise<void> {
    const product = await this.productsRepository.findById(productId);
    if (!product) throw catalogErrors.notFound("Product");
    if (product.status !== "ACTIVE" && !canSeeAllStatuses) throw catalogErrors.notFound("Product");

    const variant = await this.variantsRepository.findVariantByProductAndId(productId, variantId);
    if (!variant) throw catalogErrors.notFound("Variant");
  }

  /// An inactive/unknown market is a closed business boundary and behaves
  /// as "not found" — same rule Catalog/Pricing apply.
  private async resolveActiveMarket(marketCode: string): Promise<Market> {
    const market = await this.inventoryRepository.findActiveMarketByCode(marketCode);
    if (!market) throw catalogErrors.notFound("Market");
    return market;
  }
}
