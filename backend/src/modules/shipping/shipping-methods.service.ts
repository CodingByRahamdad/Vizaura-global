import type { Market, ShippingMethod } from "../../generated/prisma/client.js";
import { ShippingMethodsRepository } from "./shipping-methods.repository.js";
import { catalogErrors, shippingErrors } from "../../errors/AppError.js";
import type {
  CreateShippingMethodInput,
  ListAdminShippingMethodsQuery,
  UpdateShippingMethodInput,
} from "./shipping-methods.validators.js";

export interface ListResult<T> {
  methods: T[];
  total: number;
}

export class ShippingMethodsService {
  constructor(private readonly shippingMethodsRepository: ShippingMethodsRepository = new ShippingMethodsRepository()) {}

  /// The customer-facing GET /shipping/methods — active methods for one
  /// market, cheapest first (a natural default order for a picker UI).
  async listPublic(marketCode: string): Promise<ShippingMethod[]> {
    const market = await this.resolveActiveMarket(marketCode);
    return this.shippingMethodsRepository.listActiveByMarket(market.id);
  }

  async listAdmin(query: ListAdminShippingMethodsQuery, skip: number, take: number): Promise<ListResult<ShippingMethod>> {
    let marketId: string | undefined;
    if (query.market) {
      const market = await this.shippingMethodsRepository.findActiveMarketByCode(query.market);
      if (!market) return { methods: [], total: 0 };
      marketId = market.id;
    }
    return this.shippingMethodsRepository.listAdmin({ marketId, isActive: query.isActive }, skip, take);
  }

  async getById(id: string): Promise<ShippingMethod> {
    const method = await this.shippingMethodsRepository.findById(id);
    if (!method) throw shippingErrors.methodNotFound();
    return method;
  }

  async create(input: CreateShippingMethodInput): Promise<ShippingMethod> {
    const market = await this.resolveActiveMarket(input.marketCode);
    return this.shippingMethodsRepository.create({
      marketId: market.id,
      name: input.name,
      description: input.description,
      baseRate: input.baseRate,
      freeShippingThreshold: input.freeShippingThreshold,
      estimatedMinDays: input.estimatedMinDays,
      estimatedMaxDays: input.estimatedMaxDays,
      isActive: input.isActive,
    });
  }

  async update(id: string, input: UpdateShippingMethodInput): Promise<ShippingMethod> {
    await this.getById(id);
    return this.shippingMethodsRepository.update(id, input);
  }

  /// Archive, never a hard delete — see the schema's own doc comment.
  async archive(id: string): Promise<void> {
    await this.getById(id);
    await this.shippingMethodsRepository.archive(id);
  }

  /// An inactive/unknown market is a closed business boundary and behaves
  /// as "not found" — same rule Catalog/Pricing/Inventory/Checkout apply.
  private async resolveActiveMarket(marketCode: string): Promise<Market> {
    const market = await this.shippingMethodsRepository.findActiveMarketByCode(marketCode);
    if (!market) throw catalogErrors.notFound("Market");
    return market;
  }
}
