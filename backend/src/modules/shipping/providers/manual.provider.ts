import type { ShippingProvider } from "./provider.interface.js";

/// The PRD explicitly asks that "configurable internal shipping methods"
/// stay supported "even when no external courier API exists" (§15 Shipping
/// Architecture) — this is that baseline. No external call, no gateway;
/// dispatch is purely a no-op hook so a future real-carrier provider can be
/// added behind ShippingProvider without changing any call site.
export const manualProvider: ShippingProvider = {
  key: "MANUAL",

  async dispatch() {
    // Nothing to do — staff-driven PATCH .../status is the sole mechanism
    // that moves a shipment forward; there is no external system to notify.
  },
};
