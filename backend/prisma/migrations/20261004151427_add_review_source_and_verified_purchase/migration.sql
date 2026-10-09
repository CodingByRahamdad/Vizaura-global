-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('CUSTOMER', 'ADMIN', 'SEED');

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_userId_fkey";

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" "ReviewSource" NOT NULL DEFAULT 'CUSTOMER',
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "reviews_source_idx" ON "reviews"("source");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
