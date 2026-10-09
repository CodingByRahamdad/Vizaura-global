import type { Market } from "./markets.repository.js";

export interface PublicMarket {
  id: string;
  code: string;
  name: string;
  currencyCode: string;
  currencyMinorUnits: number;
}

export interface AdminMarket extends PublicMarket {
  timezone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicMarket(market: Market): PublicMarket {
  return {
    id: market.id,
    code: market.code,
    name: market.name,
    currencyCode: market.currencyCode,
    currencyMinorUnits: market.currencyMinorUnits,
  };
}

export function toAdminMarket(market: Market): AdminMarket {
  return {
    ...toPublicMarket(market),
    timezone: market.timezone,
    isActive: market.isActive,
    createdAt: market.createdAt,
    updatedAt: market.updatedAt,
  };
}
