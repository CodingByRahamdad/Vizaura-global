import { MarketsRepository, type Market } from "./markets.repository.js";
import { marketsErrors } from "../../errors/AppError.js";

export class MarketsService {
  constructor(private readonly marketsRepository: MarketsRepository = new MarketsRepository()) {}

  async listActive(): Promise<Market[]> {
    return this.marketsRepository.listActive();
  }

  async listAll(): Promise<Market[]> {
    return this.marketsRepository.listAll();
  }

  async updateIsActive(id: string, isActive: boolean): Promise<{ market: Market; previousIsActive: boolean }> {
    const existing = await this.marketsRepository.findById(id);
    if (!existing) throw marketsErrors.notFound();
    const market = await this.marketsRepository.updateIsActive(id, isActive);
    return { market, previousIsActive: existing.isActive };
  }
}
