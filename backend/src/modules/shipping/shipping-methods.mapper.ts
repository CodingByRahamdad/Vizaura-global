import type { ShippingMethod } from "../../generated/prisma/client.js";

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

export function toShippingMethodView(method: ShippingMethod): ShippingMethodView {
  return {
    id: method.id,
    marketId: method.marketId,
    name: method.name,
    description: method.description,
    baseRate: method.baseRate,
    freeShippingThreshold: method.freeShippingThreshold,
    estimatedMinDays: method.estimatedMinDays,
    estimatedMaxDays: method.estimatedMaxDays,
    isActive: method.isActive,
    createdAt: method.createdAt.toISOString(),
    updatedAt: method.updatedAt.toISOString(),
  };
}
