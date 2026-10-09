/**
 * Mirrors backend/src/modules/shipping/shipping-methods.mapper.ts verbatim.
 */

export interface ShippingMethodView {
  id: string;
  marketId: string;
  name: string;
  description: string | null;
  baseRate: number;
  freeShippingThreshold: number | null;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
