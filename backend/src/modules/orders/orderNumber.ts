import type { Prisma } from "../../generated/prisma/client.js";

type TxClient = Prisma.TransactionClient;

/// Backs `Order.orderNumber` with a hand-added Postgres SEQUENCE (see
/// checkout's migrations) — Prisma's schema language has no way to express
/// a formatted, DB-generated default. Sequences are non-transactional by
/// design — a rolled-back attempt can leave a gap — which is fine: order
/// numbers only need to be unique, not gapless. Shared by both
/// checkout.repository.ts (online orders) and orders.repository.ts (admin
/// offline orders) — two real callers, so this lives in one place rather
/// than being copied a second time.
export async function generateOrderNumber(tx: TxClient): Promise<string> {
  const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('order_number_seq') AS nextval`;
  const year = new Date().getUTCFullYear();
  return `ORD-${year}-${rows[0]!.nextval.toString().padStart(6, "0")}`;
}
