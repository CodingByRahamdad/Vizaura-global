-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateTable
CREATE TABLE "variant_stocks" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variant_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "resultingOnHand" INTEGER NOT NULL,
    "reason" VARCHAR(255),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference" VARCHAR(255) NOT NULL,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "variant_stocks_marketId_idx" ON "variant_stocks"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "variant_stocks_variantId_marketId_key" ON "variant_stocks"("variantId", "marketId");

-- CreateIndex
CREATE INDEX "stock_movements_stockId_idx" ON "stock_movements"("stockId");

-- CreateIndex
CREATE INDEX "stock_reservations_stockId_idx" ON "stock_reservations"("stockId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_reservations_stockId_reference_key" ON "stock_reservations"("stockId", "reference");

-- AddForeignKey
ALTER TABLE "variant_stocks" ADD CONSTRAINT "variant_stocks_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_stocks" ADD CONSTRAINT "variant_stocks_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "variant_stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "variant_stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-added: negative inventory must never be representable at the
-- database layer, not just rejected in application code (docs/DATABASE.md).
-- Not expressible in the Prisma schema language (no native CHECK support).
-- CheckConstraint
ALTER TABLE "variant_stocks" ADD CONSTRAINT "variant_stocks_onHand_check" CHECK ("onHand" >= 0);

-- CheckConstraint
ALTER TABLE "variant_stocks" ADD CONSTRAINT "variant_stocks_reserved_check" CHECK ("reserved" >= 0 AND "reserved" <= "onHand");
