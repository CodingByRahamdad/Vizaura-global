import type { Market, PrismaClient, VariantPrice } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";

export interface UpsertPriceData {
  currencyCode: string;
  amount: number;
  saleAmount?: number | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
  isActive?: boolean;
}

export class PricingRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  /// Direct read against the shared `markets` table — the same pattern
  /// Catalog's own repository already uses (products.repository.ts
  /// resolveMarketIdsByCode), not a cross-module Catalog import. Only
  /// active markets resolve; an inactive market is a closed business
  /// boundary and must behave as "not found", exactly like Catalog's rule.
  async findActiveMarketByCode(code: string): Promise<Market | null> {
    return this.prisma.market.findFirst({ where: { code, isActive: true } });
  }

  /// Not implemented as `prisma.variantPrice.upsert` — under this project's
  /// Prisma 7 + `@prisma/adapter-pg` transport that is emulated client-side
  /// (try create, fall back to update) rather than a single atomic
  /// `INSERT ... ON CONFLICT`, so two genuinely concurrent requests can each
  /// attempt "create" and one gets a raw unique-constraint error instead of
  /// cleanly falling through to "update" (reproduced directly against the
  /// real test database). Handling the race explicitly here — try create,
  /// and on a unique-constraint collision fall back to update — is atomic
  /// per statement and gives the same "exactly one current row" result.
  async upsertPrice(variantId: string, marketId: string, data: UpsertPriceData): Promise<VariantPrice & { market: Market }> {
    try {
      return await this.prisma.variantPrice.create({
        data: { variantId, marketId, ...data },
        include: { market: true },
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error, "variantId")) throw error;
      return this.prisma.variantPrice.update({
        where: { variantId_marketId: { variantId, marketId } },
        data,
        include: { market: true },
      });
    }
  }

  async findPrice(variantId: string, marketId: string): Promise<(VariantPrice & { market: Market }) | null> {
    return this.prisma.variantPrice.findUnique({
      where: { variantId_marketId: { variantId, marketId } },
      include: { market: true },
    });
  }

  async findPricesByVariant(variantId: string): Promise<(VariantPrice & { market: Market })[]> {
    return this.prisma.variantPrice.findMany({
      where: { variantId },
      include: { market: true },
      orderBy: { market: { code: "asc" } },
    });
  }

  /// Batched read for a page of product cards (products.service.ts::
  /// listWithCards) — one query for every variant on the page instead of one
  /// query per product, keeping the card list's query count fixed regardless
  /// of page size.
  async findActivePricesByVariantIds(variantIds: string[], marketCode: string): Promise<(VariantPrice & { market: Market })[]> {
    if (variantIds.length === 0) return [];
    return this.prisma.variantPrice.findMany({
      where: { variantId: { in: variantIds }, market: { code: marketCode }, isActive: true },
      include: { market: true },
    });
  }

  /// Admin batched read (products.service.ts::listForAdmin) — every price
  /// row for the given variants across every market, active or not, unlike
  /// findActivePricesByVariantIds (storefront cards, one market, active
  /// only). Admin needs to see "no price set for AE" accurately rather than
  /// have an inactive/missing row silently omitted.
  async findPricesByVariantIds(variantIds: string[]): Promise<(VariantPrice & { market: Market })[]> {
    if (variantIds.length === 0) return [];
    return this.prisma.variantPrice.findMany({
      where: { variantId: { in: variantIds } },
      include: { market: true },
    });
  }

  async deactivatePrice(variantId: string, marketId: string): Promise<VariantPrice | null> {
    const existing = await this.prisma.variantPrice.findUnique({ where: { variantId_marketId: { variantId, marketId } } });
    if (!existing) return null;
    return this.prisma.variantPrice.update({ where: { id: existing.id }, data: { isActive: false } });
  }
}
