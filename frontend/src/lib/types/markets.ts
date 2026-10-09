/**
 * Types mirror the backend's market response shapes verbatim
 * (backend/src/modules/markets/markets.mapper.ts — PublicMarket/AdminMarket).
 */

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
  createdAt: string;
  updatedAt: string;
}

export const ADMIN_MARKETS_ERROR_MESSAGES: Partial<Record<string, string>> = {
  MARKETS_NOT_FOUND: "That market could not be found.",
  MARKETS_VALIDATION_ERROR: "Please check the values entered and try again.",
};
