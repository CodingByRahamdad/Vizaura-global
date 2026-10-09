-- Hand-added (Prisma has no native CHECK syntax) — same judgment call
-- docs/DATABASE.md already documents for variant_stocks: a simple numeric
-- CHECK is worth it as defense-in-depth alongside the service-layer
-- quantity validation (cart.validators.ts / cart.service.ts).
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0);
