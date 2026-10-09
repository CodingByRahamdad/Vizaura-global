import type { Address } from "../../generated/prisma/client.js";

export interface AddressView {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
  updatedAt: string;
}

export interface AddressesView {
  billing: AddressView | null;
  shipping: AddressView | null;
}

function toAddressView(address: Address): AddressView {
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    updatedAt: address.updatedAt.toISOString(),
  };
}

export function toAddressesView(addresses: Address[]): AddressesView {
  const billing = addresses.find((a) => a.type === "BILLING") ?? null;
  const shipping = addresses.find((a) => a.type === "SHIPPING") ?? null;
  return {
    billing: billing ? toAddressView(billing) : null,
    shipping: shipping ? toAddressView(shipping) : null,
  };
}

export { toAddressView };
