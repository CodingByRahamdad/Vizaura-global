import type {
  MediaType,
  Prisma,
  PrismaClient,
  ProductMedia,
  ProductOption,
  ProductOptionValue,
  ProductVariant,
  VariantStatus,
} from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";
import { buildProductDetailInclude } from "./products.repository.js";

type VariantWithAssignments = ProductVariant & {
  optionValues: { optionId: string; optionValueId: string }[];
};

type TxClient = Prisma.TransactionClient;

/// Thrown from inside a locked transaction when the proposed option-value
/// set for a variant exactly matches another active variant's set on the
/// same product. Not an AppError — repositories stay Prisma-only per
/// docs/ARCHITECTURE.md; the service layer catches and translates this.
export class DuplicateVariantCombinationError extends Error {}

/// Thrown from inside removeVariant's transaction when the target variant
/// is (by then) the product's only remaining active variant.
export class LastVariantError extends Error {}

export class VariantsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  // -- Variants -----------------------------------------------------------

  /// Locks the product row for the duration of the transaction. Neither
  /// isDefault (ProductVariant) nor isPrimary (ProductMedia) has a database
  /// constraint limiting it to one true row per product, so under READ
  /// COMMITTED two concurrent transactions could each flip a different row
  /// to true without ever conflicting. Locking the parent product row here
  /// serializes every per-product single-flag invariant against itself.
  private async lockProduct(tx: TxClient, productId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`;
  }

  /// Throws DuplicateVariantCombinationError if `optionValueIds` (as a set)
  /// exactly matches another active variant's assigned set on this product.
  /// A variant with no option values never collides with anything. Must run
  /// inside the same locked transaction as the write it's guarding.
  private async assertNoDuplicateCombination(
    tx: TxClient,
    productId: string,
    optionValueIds: string[],
    excludeVariantId?: string,
  ): Promise<void> {
    if (optionValueIds.length === 0) return;
    const proposed = [...optionValueIds].sort().join(",");

    const others = await tx.productVariant.findMany({
      where: { productId, deletedAt: null, ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}) },
      include: { optionValues: { select: { optionValueId: true } } },
    });
    const collides = others.some((other) => {
      if (other.optionValues.length !== optionValueIds.length) return false;
      const otherSet = other.optionValues.map((v) => v.optionValueId).sort().join(",");
      return otherSet === proposed;
    });
    if (collides) throw new DuplicateVariantCombinationError();
  }

  async createVariant(
    productId: string,
    data: { sku: string; title: string; status?: VariantStatus; position?: number; isDefault?: boolean },
    optionValueIds: string[],
  ): Promise<ProductVariant> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockProduct(tx, productId);
      await this.assertNoDuplicateCombination(tx, productId, optionValueIds);

      if (data.isDefault) {
        await tx.productVariant.updateMany({ where: { productId, deletedAt: null }, data: { isDefault: false } });
      }
      const variant = await tx.productVariant.create({
        data: {
          productId,
          sku: data.sku,
          title: data.title,
          status: data.status,
          position: data.position,
          isDefault: data.isDefault ?? false,
        },
      });
      if (optionValueIds.length > 0) {
        const values = await tx.productOptionValue.findMany({ where: { id: { in: optionValueIds } } });
        await tx.variantOptionValue.createMany({
          data: values.map((value) => ({
            variantId: variant.id,
            optionId: value.optionId,
            optionValueId: value.id,
          })),
        });
      }
      return variant;
    });
  }

  async findVariantByProductAndId(productId: string, variantId: string): Promise<VariantWithAssignments | null> {
    return this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, deletedAt: null },
      include: { optionValues: { select: { optionId: true, optionValueId: true } } },
    });
  }

  async listVariantsByProduct(productId: string, includeAllStatuses = true): Promise<ProductVariant[]> {
    return this.prisma.productVariant.findMany({
      where: { productId, deletedAt: null, ...(includeAllStatuses ? {} : { status: "ACTIVE" }) },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });
  }

  async countActiveVariants(productId: string): Promise<number> {
    return this.prisma.productVariant.count({ where: { productId, deletedAt: null } });
  }

  async variantSkuExists(sku: string, excludeVariantId?: string): Promise<boolean> {
    const existing = await this.prisma.productVariant.findFirst({
      where: { sku, deletedAt: null },
      select: { id: true },
    });
    return existing !== null && existing.id !== excludeVariantId;
  }

  async updateVariant(
    variantId: string,
    data: { title?: string; status?: VariantStatus; position?: number; isDefault?: boolean },
    optionValueIds: string[] | undefined,
  ): Promise<ProductVariant> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      await this.lockProduct(tx, current.productId);

      if (optionValueIds !== undefined && optionValueIds.length > 0) {
        await this.assertNoDuplicateCombination(tx, current.productId, optionValueIds, variantId);
      }

      if (data.isDefault) {
        await tx.productVariant.updateMany({
          where: { productId: current.productId, deletedAt: null, id: { not: variantId } },
          data: { isDefault: false },
        });
      }
      const variant = await tx.productVariant.update({ where: { id: variantId }, data });

      if (optionValueIds !== undefined) {
        await tx.variantOptionValue.deleteMany({ where: { variantId } });
        if (optionValueIds.length > 0) {
          const values = await tx.productOptionValue.findMany({ where: { id: { in: optionValueIds } } });
          await tx.variantOptionValue.createMany({
            data: values.map((value) => ({
              variantId,
              optionId: value.optionId,
              optionValueId: value.id,
            })),
          });
        }
      }
      return variant;
    });
  }

  /// Atomically: locks the product, re-verifies the variant is still active
  /// and not the last one, soft-deletes it, and — if it was the default —
  /// promotes the next remaining active variant (lowest position, id as
  /// tiebreak). Locking + re-verifying inside the transaction (rather than
  /// trusting a pre-check made before the transaction opened) closes the
  /// race where two concurrent deletes of a product's last two variants
  /// could otherwise both pass an outer "count > 1" check before either
  /// commits.
  async removeVariantTransaction(productId: string, variantId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockProduct(tx, productId);

      const variant = await tx.productVariant.findFirst({ where: { id: variantId, productId, deletedAt: null } });
      if (!variant) return; // already gone — soft delete is idempotent, nothing to do

      const activeCount = await tx.productVariant.count({ where: { productId, deletedAt: null } });
      if (activeCount <= 1) throw new LastVariantError();

      // Hard delete — every dependent relation (VariantOptionValue, VariantPrice,
      // VariantStock and transitively StockMovement/StockReservation, CartItem) is
      // onDelete: Cascade in the schema; ProductMedia/OrderItem are onDelete: SetNull,
      // so order history and any variant-specific media survive with the FK cleared.
      await tx.productVariant.delete({ where: { id: variantId } });

      if (variant.isDefault) {
        const next = await tx.productVariant.findFirst({
          where: { productId, deletedAt: null, id: { not: variantId } },
          orderBy: [{ position: "asc" }, { id: "asc" }],
        });
        if (next) {
          await tx.productVariant.update({ where: { id: next.id }, data: { isDefault: true } });
        }
      }
    });
  }

  // -- Options --------------------------------------------------------------

  async createOption(
    productId: string,
    data: { name: string; position?: number },
    values: string[],
  ): Promise<ProductOption & { values: ProductOptionValue[] }> {
    return this.prisma.$transaction(async (tx) => {
      const option = await tx.productOption.create({
        data: { productId, name: data.name, position: data.position },
      });
      // createMany doesn't return the created rows, and the caller (variant
      // creation) needs the new values' ids immediately — create them
      // individually inside the same transaction instead.
      const createdValues = await Promise.all(
        values.map((value, index) =>
          tx.productOptionValue.create({ data: { optionId: option.id, value, position: index } }),
        ),
      );
      return { ...option, values: createdValues };
    });
  }

  async findOptionByProductAndId(productId: string, optionId: string): Promise<ProductOption | null> {
    return this.prisma.productOption.findFirst({ where: { id: optionId, productId } });
  }

  async findOptionByProductAndName(productId: string, name: string): Promise<ProductOption | null> {
    return this.prisma.productOption.findFirst({ where: { productId, name } });
  }

  async updateOption(optionId: string, data: { name?: string; position?: number }): Promise<ProductOption> {
    return this.prisma.productOption.update({ where: { id: optionId }, data });
  }

  async deleteOption(optionId: string): Promise<void> {
    await this.prisma.productOption.delete({ where: { id: optionId } });
  }

  async countVariantAssignmentsForOption(optionId: string): Promise<number> {
    return this.prisma.variantOptionValue.count({ where: { optionId } });
  }

  async addOptionValue(
    optionId: string,
    data: { value: string; position?: number },
  ): Promise<ProductOptionValue> {
    return this.prisma.productOptionValue.create({
      data: { optionId, value: data.value, position: data.position },
    });
  }

  async findOptionValueByOptionAndValue(optionId: string, value: string): Promise<ProductOptionValue | null> {
    return this.prisma.productOptionValue.findFirst({ where: { optionId, value } });
  }

  async findOptionValueByOptionAndId(optionId: string, valueId: string): Promise<ProductOptionValue | null> {
    return this.prisma.productOptionValue.findFirst({ where: { id: valueId, optionId } });
  }

  async deleteOptionValue(valueId: string): Promise<void> {
    await this.prisma.productOptionValue.delete({ where: { id: valueId } });
  }

  async countVariantAssignmentsForOptionValue(valueId: string): Promise<number> {
    return this.prisma.variantOptionValue.count({ where: { optionValueId: valueId } });
  }

  /// Returns the option values found among `optionValueIds` that belong to
  /// options of `productId`. The caller compares the result length against
  /// the requested id count to detect unknown/cross-product values.
  async findOwnedOptionValues(
    productId: string,
    optionValueIds: string[],
  ): Promise<{ id: string; optionId: string }[]> {
    if (optionValueIds.length === 0) return [];
    return this.prisma.productOptionValue.findMany({
      where: { id: { in: optionValueIds }, option: { productId } },
      select: { id: true, optionId: true },
    });
  }

  // -- Media ------------------------------------------------------------

  async createMedia(
    productId: string,
    data: { type?: MediaType; url: string; altText?: string; variantId?: string; position?: number; isPrimary?: boolean },
  ): Promise<ProductMedia> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockProduct(tx, productId);
      if (data.isPrimary) {
        await tx.productMedia.updateMany({ where: { productId }, data: { isPrimary: false } });
      }
      return tx.productMedia.create({
        data: {
          productId,
          variantId: data.variantId,
          type: data.type,
          url: data.url,
          altText: data.altText,
          position: data.position,
          isPrimary: data.isPrimary ?? false,
        },
      });
    });
  }

  async findMediaByProductAndId(productId: string, mediaId: string): Promise<ProductMedia | null> {
    return this.prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
  }

  async updateMedia(
    productId: string,
    mediaId: string,
    data: { type?: MediaType; url?: string; altText?: string; variantId?: string | null; position?: number; isPrimary?: boolean },
  ): Promise<ProductMedia> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockProduct(tx, productId);
      if (data.isPrimary) {
        await tx.productMedia.updateMany({ where: { productId, id: { not: mediaId } }, data: { isPrimary: false } });
      }
      return tx.productMedia.update({ where: { id: mediaId }, data });
    });
  }

  async deleteMedia(mediaId: string): Promise<void> {
    await this.prisma.productMedia.delete({ where: { id: mediaId } });
  }

  // -- Shared -------------------------------------------------------------

  async findProductDetail(productId: string) {
    return this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: buildProductDetailInclude(),
    });
  }
}
