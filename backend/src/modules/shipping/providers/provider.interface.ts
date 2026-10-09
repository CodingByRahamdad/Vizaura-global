/// PRD's own "same principle" as PaymentProvider (§2O.2 Shipping Adapter):
/// `ShippingService -> ShippingProvider -> Provider implementation`. Unlike
/// Payments, there is no webhook and no second (test/dev) provider to
/// justify a fuller interface — this is intentionally minimal, a genuine
/// extension point for a future real-carrier phase rather than a stub built
/// out ahead of any actual need. `dispatch` is the only method a carrier
/// integration would ever need to hook: notifying an external system that a
/// shipment has moved to SHIPPED. It does no DB access — ShipmentsService
/// stays the only place that touches Prisma.
export interface ShippingProvider {
  readonly key: string;
  dispatch(params: { shipmentId: string; trackingNumber: string | null; carrier: string | null }): Promise<void>;
}
