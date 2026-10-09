-- AlterTable
ALTER TABLE "products" ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "shelfLife" VARCHAR(200),
ADD COLUMN     "storageInstructions" VARCHAR(500);
