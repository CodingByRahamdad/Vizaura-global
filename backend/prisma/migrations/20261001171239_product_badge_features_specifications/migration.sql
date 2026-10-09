-- CreateEnum
CREATE TYPE "ProductBadge" AS ENUM ('BEST_SELLER', 'NEW');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "badge" "ProductBadge",
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "specifications" JSONB;
