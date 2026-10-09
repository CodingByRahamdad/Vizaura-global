-- CreateEnum
CREATE TYPE "order_address_type" AS ENUM ('BILLING', 'SHIPPING');

-- AlterTable: add the column nullable first so existing rows aren't rejected
ALTER TABLE "order_addresses" ADD COLUMN "type" "order_address_type";

-- Backfill: every existing row already functions as the shipping/delivery
-- address everywhere it's read, so it becomes the SHIPPING row.
UPDATE "order_addresses" SET "type" = 'SHIPPING';

-- DropIndex: the old one-row-per-order unique constraint must go BEFORE
-- inserting a second (BILLING) row per order below, or the insert violates it.
DROP INDEX "order_addresses_orderId_key";

-- Backfill: synthesize a BILLING row for every existing order by copying its
-- (former) single address, so old orders also end up with exactly 2 rows and
-- no consumer that expects a BILLING row to exist ever sees a gap.
INSERT INTO "order_addresses"
  (id, "orderId", type, "fullName", phone, line1, line2, city, region, "postalCode", "countryCode", "createdAt")
SELECT
  gen_random_uuid(), "orderId", 'BILLING', "fullName", phone, line1, line2, city, region, "postalCode", "countryCode", "createdAt"
FROM "order_addresses"
WHERE type = 'SHIPPING';

-- Now safe to enforce NOT NULL.
ALTER TABLE "order_addresses" ALTER COLUMN "type" SET NOT NULL;

-- CreateIndex: the new compound unique (one row per type per order).
CREATE UNIQUE INDEX "order_addresses_orderId_type_key" ON "order_addresses"("orderId", "type");
