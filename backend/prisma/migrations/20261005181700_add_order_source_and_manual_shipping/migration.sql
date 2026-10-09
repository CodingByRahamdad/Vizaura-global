-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('ONLINE', 'OFFLINE');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "shipping_methods" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true;
