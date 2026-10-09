/// Shared by Checkout, admin order creation, and admin order editing — the
/// one place "how a subtotal is computed from lines" is defined, so all
/// three never drift out of sync with each other.
export function computeSubtotal(lines: { lineTotal: number }[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotal, 0);
}
