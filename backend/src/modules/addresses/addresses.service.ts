import { AddressesRepository, type UpsertAddressData } from "./addresses.repository.js";
import { toAddressesView, toAddressView, type AddressesView, type AddressView } from "./addresses.mapper.js";
import type { AddressType } from "../../generated/prisma/client.js";

export class AddressesService {
  constructor(private readonly addressesRepository: AddressesRepository = new AddressesRepository()) {}

  async getMine(userId: string): Promise<AddressesView> {
    const addresses = await this.addressesRepository.findAllForUser(userId);
    return toAddressesView(addresses);
  }

  async upsert(userId: string, type: AddressType, data: UpsertAddressData): Promise<AddressView> {
    const address = await this.addressesRepository.upsert(userId, type, data);
    return toAddressView(address);
  }
}
