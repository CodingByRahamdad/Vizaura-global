/**
 * Mirrors the backend's actual response shapes verbatim
 * (backend/src/modules/addresses/addresses.mapper.ts). Field names
 * intentionally match checkout's ShippingAddressInput shape so a saved
 * address can be copied straight into the checkout form.
 */

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

export interface UpsertAddressPayload {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode: string;
}
