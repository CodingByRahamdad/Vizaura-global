/**
 * Admin order formatting. Money is always rendered in the ORDER'S OWN stored
 * currency (never the admin's storefront market cookie, never converted).
 * Amounts are Int minor units; both PKR and AED use 2 decimal places.
 */
export function formatOrderMoney(amountMinor: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(amountMinor / 100);
}

export function formatOrderDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
}
