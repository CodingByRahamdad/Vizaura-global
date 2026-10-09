import type {
  Market,
  Prisma,
  PrismaClient,
  Product,
  ProductVariant,
  StockMovementType,
  VariantStock,
} from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";

/// Thrown from inside a guarded-update transaction when the requested
/// change would violate a stock invariant (onHand < 0, reserved > onHand,
/// or reserved would exceed available). Not an AppError — repositories stay
/// Prisma-only (docs/ARCHITECTURE.md); the service layer translates this.
export class InsufficientStockError extends Error {}

export interface AdminInventoryFilter {
  search?: string;
  marketCode?: string;
  skip: number;
  take: number;
}

export interface AdminInventoryRow extends VariantStock {
  market: Market;
  variant: ProductVariant & { product: Product };
}

export class InventoryRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findActiveMarketByCode(code: string): Promise<Market | null> {
    return this.prisma.market.findFirst({ where: { code, isActive: true } });
  }

  async findByVariantAndMarket(variantId: string, marketId: string): Promise<VariantStock | null> {
    return this.prisma.variantStock.findUnique({ where: { variantId_marketId: { variantId, marketId } } });
  }

  async findAllByVariant(variantId: string): Promise<(VariantStock & { market: Market })[]> {
    return this.prisma.variantStock.findMany({
      where: { variantId },
      include: { market: true },
      orderBy: { market: { code: "asc" } },
    });
  }

  async create(variantId: string, marketId: string, onHand: number): Promise<VariantStock> {
    return this.prisma.variantStock.create({ data: { variantId, marketId, onHand } });
  }

  /// Batched read for a page of product cards (products.service.ts::
  /// listWithCards) — one query for every variant on the page instead of one
  /// query per product.
  async findByVariantIdsAndMarket(variantIds: string[], marketCode: string): Promise<(VariantStock & { market: Market })[]> {
    if (variantIds.length === 0) return [];
    return this.prisma.variantStock.findMany({
      where: { variantId: { in: variantIds }, market: { code: marketCode } },
      include: { market: true },
    });
  }

  /// Admin batched read (products.service.ts::listForAdmin) — every stock
  /// row for the given variants across every market, unlike
  /// findByVariantIdsAndMarket (storefront cards, one market only).
  async findByVariantIds(variantIds: string[]): Promise<(VariantStock & { market: Market })[]> {
    if (variantIds.length === 0) return [];
    return this.prisma.variantStock.findMany({
      where: { variantId: { in: variantIds } },
      include: { market: true },
    });
  }

  /// Admin cross-catalog list (Phase 6E) — unlike every other read here,
  /// this is not scoped to one product+variant; it's the first Inventory
  /// endpoint that lists across the whole catalog at once, joined up to the
  /// variant/product/market for display. Excludes soft-deleted
  /// products/variants; a variant can appear once per market it has a
  /// VariantStock row for (a variant with no stock row for a market simply
  /// has no row here — never fabricated as zero).
  async listForAdmin(filter: AdminInventoryFilter): Promise<{ rows: AdminInventoryRow[]; total: number }> {
    const variantWhere: Prisma.ProductVariantWhereInput = {
      deletedAt: null,
      product: { deletedAt: null },
      ...(filter.search
        ? {
            OR: [
              { sku: { contains: filter.search, mode: "insensitive" } },
              { product: { deletedAt: null, name: { contains: filter.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const where: Prisma.VariantStockWhereInput = {
      variant: variantWhere,
      ...(filter.marketCode ? { market: { code: filter.marketCode } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.variantStock.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: [{ variant: { product: { name: "asc" } } }, { market: { code: "asc" } }],
        include: {
          market: true,
          variant: { include: { product: true } },
        },
      }),
      this.prisma.variantStock.count({ where }),
    ]);

    return { rows, total };
  }

  /// Always safe beyond the DB's own CHECK (a positive receipt can never
  /// make onHand negative) — no conditional guard needed, but still atomic
  /// and still paired with its movement row in one transaction.
  async receive(stockId: string, quantity: number, reason: string | undefined, userId: string | undefined) {
    return this.recordMovement(stockId, "RECEIPT", quantity, reason, userId);
  }

  /// `delta` may be positive or negative. Guarded: rejected if it would take
  /// onHand below 0 or below the currently reserved quantity.
  async adjust(stockId: string, delta: number, reason: string, userId: string | undefined) {
    return this.recordMovement(stockId, "ADJUSTMENT", delta, reason, userId);
  }

  private async recordMovement(
    stockId: string,
    type: StockMovementType,
    delta: number,
    reason: string | undefined,
    userId: string | undefined,
  ): Promise<VariantStock> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRaw<{ id: string; onHand: number; reserved: number }[]>`
        UPDATE variant_stocks
        SET "onHand" = "onHand" + ${delta}, "updatedAt" = now()
        WHERE id = ${stockId} AND "onHand" + ${delta} >= "reserved" AND "onHand" + ${delta} >= 0
        RETURNING id, "onHand", "reserved"
      `;
      const row = updated[0];
      if (!row) throw new InsufficientStockError();

      await tx.stockMovement.create({
        data: {
          stockId,
          type,
          quantityDelta: delta,
          resultingOnHand: row.onHand,
          reason,
          createdByUserId: userId,
        },
      });

      return tx.variantStock.findUniqueOrThrow({ where: { id: stockId } });
    });
  }

  /// Idempotent per (stockId, reference): if an ACTIVE reservation already
  /// exists for this reference, returns it unchanged rather than
  /// double-reserving. Guarded: rejected if the requested quantity exceeds
  /// currently available stock (onHand - reserved).
  async reserve(stockId: string, quantity: number, reference: string): Promise<VariantStock> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockReservation.findUnique({
        where: { stockId_reference: { stockId, reference } },
      });
      if (existing && existing.status === "ACTIVE") {
        return tx.variantStock.findUniqueOrThrow({ where: { id: stockId } });
      }

      const updated = await tx.$queryRaw<{ id: string }[]>`
        UPDATE variant_stocks
        SET "reserved" = "reserved" + ${quantity}, "updatedAt" = now()
        WHERE id = ${stockId} AND "onHand" - "reserved" >= ${quantity}
        RETURNING id
      `;
      if (updated.length === 0) throw new InsufficientStockError();

      if (existing) {
        // A previously RELEASED reservation for the same reference — revive
        // it rather than creating a second row (the unique constraint would
        // reject a duplicate anyway).
        await tx.stockReservation.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", quantity, releasedAt: null },
        });
      } else {
        // Two genuinely concurrent reserve() calls for the identical
        // (stockId, reference) can both pass the `existing` check above
        // before either commits (discovered via Checkout's idempotent-
        // retry concurrency tests, Phase 4I). A SAVEPOINT is required
        // around the insert attempt: Postgres aborts the *entire*
        // transaction on any error (25P02) until a ROLLBACK, so a plain
        // try/catch here cannot simply continue with a compensating
        // statement afterward without one.
        await tx.$executeRaw`SAVEPOINT reserve_insert`;
        try {
          await tx.stockReservation.create({ data: { stockId, reference, quantity, status: "ACTIVE" } });
        } catch (error) {
          if (!isUniqueConstraintViolation(error, "reference")) throw error;
          // The reservation this reference maps to already exists and is
          // ACTIVE (a concurrent caller's transaction committed it first) —
          // roll back just the failed insert, then undo this call's own
          // guarded increment above, so it ends up the idempotent no-op it
          // was always meant to be rather than double-counting `reserved`
          // for one logical reservation.
          await tx.$executeRaw`ROLLBACK TO SAVEPOINT reserve_insert`;
          await tx.$executeRaw`
            UPDATE variant_stocks SET "reserved" = "reserved" - ${quantity}, "updatedAt" = now()
            WHERE id = ${stockId}
          `;
        }
      }

      return tx.variantStock.findUniqueOrThrow({ where: { id: stockId } });
    });
  }

  /// Idempotent: releasing a reference with no ACTIVE reservation is a
  /// no-op. Always safe to decrement by the reservation's own recorded
  /// quantity — it can never exceed `reserved`.
  async release(stockId: string, reference: string): Promise<VariantStock> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockReservation.findUnique({
        where: { stockId_reference: { stockId, reference } },
      });
      if (!existing || existing.status !== "ACTIVE") {
        return tx.variantStock.findUniqueOrThrow({ where: { id: stockId } });
      }

      await tx.$executeRaw`
        UPDATE variant_stocks
        SET "reserved" = "reserved" - ${existing.quantity}, "updatedAt" = now()
        WHERE id = ${stockId}
      `;
      await tx.stockReservation.update({
        where: { id: existing.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });

      return tx.variantStock.findUniqueOrThrow({ where: { id: stockId } });
    });
  }
}
