-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "grid2BadgeText" VARCHAR(50),
ADD COLUMN     "grid2CtaLink" VARCHAR(2048),
ADD COLUMN     "grid2CtaText" VARCHAR(50),
ADD COLUMN     "grid2DiscountPercent" INTEGER,
ADD COLUMN     "grid2ImageUrl" VARCHAR(2048),
ADD COLUMN     "grid2Overline" VARCHAR(100),
ADD COLUMN     "grid2Subtitle" VARCHAR(500),
ADD COLUMN     "grid2TargetCategoryId" UUID,
ADD COLUMN     "grid2TargetProductId" UUID,
ADD COLUMN     "grid2TargetType" "PromotionTargetType",
ADD COLUMN     "grid2Title" VARCHAR(200);

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_grid2TargetProductId_fkey" FOREIGN KEY ("grid2TargetProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_grid2TargetCategoryId_fkey" FOREIGN KEY ("grid2TargetCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
