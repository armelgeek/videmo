-- AlterTable
ALTER TABLE "CreditTransaction" ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE INDEX "CreditTransaction_referenceId_idx" ON "CreditTransaction"("referenceId");

