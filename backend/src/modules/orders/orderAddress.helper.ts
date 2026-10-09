import type { OrderAddressType } from "../../generated/prisma/client.js";

/// Every Order has exactly 2 OrderAddress rows (BILLING, SHIPPING) — see the
/// schema's own doc comment on OrderAddress. Centralizes the "pick the one
/// of this type" lookup so mappers never repeat `.find(...)` inline. Generic
/// over the projection (full OrderAddress, or a narrower `select`) so both
/// the admin list's `{ type, fullName }` projection and the full detail row
/// can reuse it.
export function pickAddress<T extends { type: OrderAddressType }>(addresses: T[], type: OrderAddressType): T | undefined {
  return addresses.find((address) => address.type === type);
}
