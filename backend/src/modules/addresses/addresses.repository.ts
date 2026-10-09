import type { Address, AddressType, PrismaClient } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export interface UpsertAddressData {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode: string;
}

/// Only this file touches Prisma for Addresses. Every read/write is scoped
/// by userId in the query shape itself — ownership is structural, not merely
/// checked, same posture as WishlistRepository.
export class AddressesRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findAllForUser(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({ where: { userId } });
  }

  /// Exactly one row per (userId, type) — upsert, never a second row.
  async upsert(userId: string, type: AddressType, data: UpsertAddressData): Promise<Address> {
    return this.prisma.address.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, ...data },
      update: { ...data },
    });
  }
}
