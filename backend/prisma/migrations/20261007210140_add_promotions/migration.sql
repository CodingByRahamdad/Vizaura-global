-- CreateEnum
CREATE TYPE "PromotionTargetType" AS ENUM ('PRODUCT', 'CATEGORY');

-- CreateEnum
CREATE TYPE "PromotionDisplayLayout" AS ENUM ('SINGLE', 'GRID');

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" VARCHAR(500),
    "badgeText" VARCHAR(50),
    "discountPercent" INTEGER,
    "ctaText" VARCHAR(50) NOT NULL DEFAULT 'Shop Now',
    "ctaLink" VARCHAR(2048),
    "imageUrl" VARCHAR(2048),
    "targetType" "PromotionTargetType",
    "targetProductId" UUID,
    "targetCategoryId" UUID,
    "displayLayout" "PromotionDisplayLayout" NOT NULL DEFAULT 'SINGLE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_isDraft_idx" ON "promotions"("isDraft");

-- CreateIndex
CREATE INDEX "promotions_displayLayout_idx" ON "promotions"("displayLayout");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_targetCategoryId_fkey" FOREIGN KEY ("targetCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
