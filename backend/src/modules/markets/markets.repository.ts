import type { Market, PrismaClient } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export type { Market } from "../../generated/prisma/client.js";

export class MarketsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async listActive(): Promise<Market[]> {
    return this.prisma.market.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
  }

  async listAll(): Promise<Market[]> {
    return this.prisma.market.findMany({ orderBy: { code: "asc" } });
  }

  async findById(id: string): Promise<Market | null> {
    return this.prisma.market.findUnique({ where: { id } });
  }

  async updateIsActive(id: string, isActive: boolean): Promise<Market> {
    return this.prisma.market.update({ where: { id }, data: { isActive } });
  }
}
