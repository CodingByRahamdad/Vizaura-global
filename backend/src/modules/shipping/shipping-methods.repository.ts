import type { Market, PrismaClient, ShippingMethod } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export interface AdminShippingMethodFilters {
  marketId?: string;
  isActive?: boolean;
}

export interface CreateShippingMethodData {
  marketId: string;
  name: string;
  description?: string;
  baseRate: number;
  freeShippingThreshold?: number;
  estimatedMinDays?: number;
  estimatedMaxDays?: number;
  isActive?: boolean;
}

export interface UpdateShippingMethodData {
  name?: string;
  description?: string;
  baseRate?: number;
  freeShippingThreshold?: number;
  estimatedMinDays?: number;
  estimatedMaxDays?: number;
  isActive?: boolean;
}

const listOrderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export class ShippingMethodsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  /// Duplicated per-module market lookup — the same established pattern
  /// Checkout/Inventory/Pricing/Cart each already carry (no Markets service
  /// exists yet).
  async findActiveMarketByCode(code: string): Promise<Market | null> {
    return this.prisma.market.findFirst({ where: { code, isActive: true } });
  }

  async findById(id: string): Promise<ShippingMethod | null> {
    return this.prisma.shippingMethod.findUnique({ where: { id } });
  }

  /// Used by Checkout to validate a submitted shippingMethodId — must be
  /// active, public, AND belong to the checkout's own market, matching the
  /// same "closed business boundary" rule Catalog/Pricing/Inventory apply to
  /// an inactive/unknown market. isPublic: true is required here too (not
  /// just in listActiveByMarket) so a customer can never check out by
  /// directly submitting the non-public "Manual" method's id.
  async findActiveByIdAndMarket(id: string, marketId: string): Promise<ShippingMethod | null> {
    return this.prisma.shippingMethod.findFirst({ where: { id, marketId, isActive: true, isPublic: true } });
  }

  /// The customer-facing list — active, public methods for one market only.
  /// isPublic: true excludes methods that exist only to satisfy an admin-
  /// entered offline order's Shipment FK (e.g. the seeded "Manual" method) —
  /// those must never be selectable at storefront checkout. No pagination:
  /// a market's method count is small and bounded by what staff configure,
  /// unlike Catalog listings.
  async listActiveByMarket(marketId: string): Promise<ShippingMethod[]> {
    return this.prisma.shippingMethod.findMany({
      where: { marketId, isActive: true, isPublic: true },
      orderBy: [{ baseRate: "asc" }, { id: "asc" }],
    });
  }

  /// Used only by the Orders module's admin create-order flow to attach the
  /// seeded non-public "Manual" method for a given market — never exposed
  /// to the storefront (see listActiveByMarket above).
  async findManualMethodByMarket(marketId: string): Promise<ShippingMethod | null> {
    return this.prisma.shippingMethod.findFirst({ where: { marketId, name: "Manual", isPublic: false } });
  }

  async listAdmin(
    filters: AdminShippingMethodFilters,
    skip: number,
    take: number,
  ): Promise<{ methods: ShippingMethod[]; total: number }> {
    const where = {
      ...(filters.marketId ? { marketId: filters.marketId } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    };

    const [methods, total] = await Promise.all([
      this.prisma.shippingMethod.findMany({ where, orderBy: listOrderBy, skip, take }),
      this.prisma.shippingMethod.count({ where }),
    ]);
    return { methods, total };
  }

  async create(data: CreateShippingMethodData): Promise<ShippingMethod> {
    return this.prisma.shippingMethod.create({ data });
  }

  async update(id: string, data: UpdateShippingMethodData): Promise<ShippingMethod> {
    return this.prisma.shippingMethod.update({ where: { id }, data });
  }

  /// DELETE maps to this — isActive=false, never a hard delete (see the
  /// schema's own doc comment and docs/modules/SHIPPING.md).
  async archive(id: string): Promise<ShippingMethod> {
    return this.prisma.shippingMethod.update({ where: { id }, data: { isActive: false } });
  }
}
