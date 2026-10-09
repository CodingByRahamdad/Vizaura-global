-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "guestEmail" VARCHAR(255),
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "addressLine1" VARCHAR(255),
ADD COLUMN     "addressLine2" VARCHAR(255),
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "countryCode" CHAR(2),
ADD COLUMN     "postalCode" VARCHAR(20),
ADD COLUMN     "region" VARCHAR(100);

-- CheckConstraint: an order is either linked to a real customer account
-- (userId set, guestEmail null) or a guest/no-account order (userId null,
-- guestEmail set) — never both, never neither. Every existing row already
-- has userId set and guestEmail null, so this is safe to add without a
-- backfill.
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_or_guest_check"
  CHECK (
    ("userId" IS NOT NULL AND "guestEmail" IS NULL) OR
    ("userId" IS NULL AND "guestEmail" IS NOT NULL)
  );
