-- Hand-added: Prisma has no native partial-index syntax (same precedent as
-- payments_orderId_active_unique and cart_items' quantity CHECK constraint).
-- Enforces at most one open Return (REQUESTED/APPROVED/RECEIVED) per Order
-- at a time; terminal ones (REJECTED/REFUNDED) stay unconstrained so a
-- later, separate partial return against the same order remains possible.
CREATE UNIQUE INDEX "returns_orderId_open_unique" ON "returns" ("orderId") WHERE "status" IN ('REQUESTED', 'APPROVED', 'RECEIVED');
