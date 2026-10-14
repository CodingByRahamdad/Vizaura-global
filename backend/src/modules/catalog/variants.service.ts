import { VariantsRepository, DuplicateVariantCombinationError, LastVariantError } from "./variants.repository.js";
import { ProductsRepository } from "./products.repository.js";
import { catalogErrors } from "../../errors/AppError.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";
import type {
  AddOptionValueInput,
  CreateMediaInput,
  CreateOptionInput,
  CreateVariantInput,
  UpdateMediaInput,
  UpdateOptionInput,
  UpdateVariantInput,
} from "./variants.validators.js";
import type {
  Product,
  ProductMedia,
  ProductOption,
  ProductOptionValue,
  ProductVariant,
} from "../../generated/prisma/client.js";

export class VariantsService {
  constructor(
    private readonly variantsRepository: VariantsRepository = new VariantsRepository(),
    private readonly productsRepository: ProductsRepository = new ProductsRepository(),
  ) {}

  // -- Variants -------------------------------------------------------------

  async createVariant(productId: string, input: CreateVariantInput): Promise<ProductVariant> {
    await this.assertProductExists(productId);
    await this.assertSkuAvailable(input.sku);
    if (input.optionValueIds?.length) {
      await this.assertOptionValuesOwnedAndDistinct(productId, input.optionValueIds);
    }

    try {
      return await this.variantsRepository.createVariant(
        productId,
        { sku: input.sku, title: input.title, status: input.status, position: input.position, isDefault: input.isDefault },
        input.optionValueIds ?? [],
      );
    } catch (error) {
      if (error instanceof DuplicateVariantCombinationError) throw catalogErrors.duplicateVariantCombination();
      if (isUniqueConstraintViolation(error, "sku")) throw catalogErrors.skuConflict(input.sku);
      throw error;
    }
  }

  /// Draft/archived products' variants are only visible to a caller who can
  /// see the product itself (see products.controller.ts's identical rule).
  async listVariants(productId: string, canSeeAllStatuses: boolean): Promise<ProductVariant[]> {
    const product = await this.getProductOrThrow(productId);
    if (product.status !== "ACTIVE" && !canSeeAllStatuses) {
      throw catalogErrors.notFound("Product");
    }
    return this.variantsRepository.listVariantsByProduct(productId, canSeeAllStatuses);
  }

  async updateVariant(productId: string, variantId: string, input: UpdateVariantInput): Promise<ProductVariant> {
    const variant = await this.assertVariantExists(productId, variantId);

    if (input.isDefault === false && variant.isDefault) {
      const others = await this.variantsRepository.listVariantsByProduct(productId);
      const hasAnotherDefaultCandidate = others.some((v) => v.id !== variantId);
      if (!hasAnotherDefaultCandidate) {
        throw catalogErrors.lastVariant();
      }
    }

    if (input.optionValueIds !== undefined && input.optionValueIds.length > 0) {
      await this.assertOptionValuesOwnedAndDistinct(productId, input.optionValueIds);
    }

    try {
      return await this.variantsRepository.updateVariant(
        variantId,
        { title: input.title, status: input.status, position: input.position, isDefault: input.isDefault },
        input.optionValueIds,
      );
    } catch (error) {
      if (error instanceof DuplicateVariantCombinationError) throw catalogErrors.duplicateVariantCombination();
      throw error;
    }
  }

  async removeVariant(productId: string, variantId: string): Promise<void> {
    await this.assertVariantExists(productId, variantId);
    try {
      await this.variantsRepository.removeVariantTransaction(productId, variantId);
    } catch (error) {
      if (error instanceof LastVariantError) throw catalogErrors.lastVariant();
      throw error;
    }
  }

  // -- Options ----------------------------------------------------------

  async createOption(
    productId: string,
    input: CreateOptionInput,
  ): Promise<ProductOption & { values: ProductOptionValue[] }> {
    await this.assertProductExists(productId);
    const existing = await this.variantsRepository.findOptionByProductAndName(productId, input.name);
    if (existing) throw catalogErrors.duplicateOptionName(input.name);

    const uniqueValues = [...new Set(input.values)];
    return this.variantsRepository.createOption(productId, { name: input.name, position: input.position }, uniqueValues);
  }

  async updateOption(productId: string, optionId: string, input: UpdateOptionInput): Promise<ProductOption> {
    await this.assertOptionExists(productId, optionId);
    if (input.name) {
      const existing = await this.variantsRepository.findOptionByProductAndName(productId, input.name);
      if (existing && existing.id !== optionId) throw catalogErrors.duplicateOptionName(input.name);
    }
    return this.variantsRepository.updateOption(optionId, input);
  }

  async removeOption(productId: string, optionId: string): Promise<void> {
    await this.assertOptionExists(productId, optionId);
    const inUse = await this.variantsRepository.countVariantAssignmentsForOption(optionId);
    if (inUse > 0) throw catalogErrors.optionInUse();
    await this.variantsRepository.deleteOption(optionId);
  }

  async addOptionValue(productId: string, optionId: string, input: AddOptionValueInput): Promise<ProductOptionValue> {
    await this.assertOptionExists(productId, optionId);
    const existing = await this.variantsRepository.findOptionValueByOptionAndValue(optionId, input.value);
    if (existing) throw catalogErrors.duplicateOptionValue(input.value);
    return this.variantsRepository.addOptionValue(optionId, input);
  }

  async removeOptionValue(productId: string, optionId: string, valueId: string): Promise<void> {
    await this.assertOptionExists(productId, optionId);
    const value = await this.variantsRepository.findOptionValueByOptionAndId(optionId, valueId);
    if (!value) throw catalogErrors.notFound("Option value");

    const inUse = await this.variantsRepository.countVariantAssignmentsForOptionValue(valueId);
    if (inUse > 0) throw catalogErrors.optionValueInUse();
    await this.variantsRepository.deleteOptionValue(valueId);
  }

  // -- Media --------------------------------------------------------------

  async createMedia(
    productId: string,
    // mediaPublicId is never client-supplied (stripped by createMediaSchema
    // for the URL-paste endpoint); only the upload controller passes it,
    // after it receives it from the media provider itself.
    input: CreateMediaInput & { mediaPublicId?: string },
  ): Promise<ProductMedia> {
    await this.assertProductExists(productId);
    if (input.variantId) {
      await this.assertVariantExists(productId, input.variantId);
    }
    return this.variantsRepository.createMedia(productId, input);
  }

  async updateMedia(productId: string, mediaId: string, input: UpdateMediaInput): Promise<ProductMedia> {
    await this.assertMediaExists(productId, mediaId);
    if (input.variantId) {
      await this.assertVariantExists(productId, input.variantId);
    }
    return this.variantsRepository.updateMedia(productId, mediaId, input);
  }

  /// Returns the deleted row's URL so the controller can unlink an
  /// uploaded-to-local-disk file (Phase 6M) — an externally-pasted URL is
  /// left alone; only the controller knows the "is this our own /uploads/
  /// path" rule, so this stays a plain read-then-delete, no disk I/O here.
  async removeMedia(productId: string, mediaId: string): Promise<ProductMedia> {
    const media = await this.assertMediaExists(productId, mediaId);
    await this.variantsRepository.deleteMedia(mediaId);
    return media;
  }

  // -- Shared guards --------------------------------------------------------

  private async assertProductExists(productId: string): Promise<void> {
    await this.getProductOrThrow(productId);
  }

  private async getProductOrThrow(productId: string): Promise<Product> {
    const product = await this.productsRepository.findById(productId);
    if (!product) throw catalogErrors.notFound("Product");
    return product;
  }

  private async assertVariantExists(productId: string, variantId: string): Promise<ProductVariant> {
    const variant = await this.variantsRepository.findVariantByProductAndId(productId, variantId);
    if (!variant) throw catalogErrors.notFound("Variant");
    return variant;
  }

  private async assertOptionExists(productId: string, optionId: string): Promise<ProductOption> {
    const option = await this.variantsRepository.findOptionByProductAndId(productId, optionId);
    if (!option) throw catalogErrors.notFound("Option");
    return option;
  }

  private async assertMediaExists(productId: string, mediaId: string): Promise<ProductMedia> {
    const media = await this.variantsRepository.findMediaByProductAndId(productId, mediaId);
    if (!media) throw catalogErrors.notFound("Media");
    return media;
  }

  private async assertSkuAvailable(sku: string): Promise<void> {
    const exists = await this.variantsRepository.variantSkuExists(sku);
    if (exists) throw catalogErrors.skuConflict(sku);
  }

  /// Confirms every id in `optionValueIds` is a real option value belonging
  /// to an option of `productId`, and that no two ids share the same option
  /// axis (a variant can hold at most one value per option).
  private async assertOptionValuesOwnedAndDistinct(productId: string, optionValueIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(optionValueIds)];
    const owned = await this.variantsRepository.findOwnedOptionValues(productId, uniqueIds);
    if (owned.length !== uniqueIds.length) {
      throw catalogErrors.invalidOptionValue({ reason: "unknown_or_cross_product" });
    }
    const optionIds = owned.map((value) => value.optionId);
    if (new Set(optionIds).size !== optionIds.length) {
      throw catalogErrors.invalidOptionValue({ reason: "duplicate_option_axis" });
    }
  }
}
