-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "subcategory" TEXT;

-- CreateIndex
CREATE INDEX "Product_supplierId_category_idx" ON "Product"("supplierId", "category");
