import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AddressesView, AddressView, UpsertAddressPayload } from "@/lib/types/addresses";

/** Address data is session-sensitive — never cached, same as Wishlist/Cart. */
const NO_STORE = { cache: "no-store" as const };

export async function getMyAddresses(): Promise<AddressesView> {
  return withAuthRetry(() => apiFetch<AddressesView>(ENDPOINTS.addresses.root, NO_STORE));
}

export async function upsertBillingAddress(payload: UpsertAddressPayload): Promise<AddressView> {
  return withAuthRetry(() =>
    apiFetch<AddressView>(ENDPOINTS.addresses.billing, {
      method: "PUT",
      body: JSON.stringify(payload),
      ...NO_STORE,
    })
  );
}

export async function upsertShippingAddress(payload: UpsertAddressPayload): Promise<AddressView> {
  return withAuthRetry(() =>
    apiFetch<AddressView>(ENDPOINTS.addresses.shipping, {
      method: "PUT",
      body: JSON.stringify(payload),
      ...NO_STORE,
    })
  );
}
