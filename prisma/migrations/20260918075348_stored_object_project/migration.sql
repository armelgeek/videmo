-- AlterTable
ALTER TABLE "stored_objects" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "stored_objects_projectId_idx" ON "stored_objects"("projectId");

-- AddForeignKey
ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
