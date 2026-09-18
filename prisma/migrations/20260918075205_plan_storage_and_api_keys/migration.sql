-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "stored_objects" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_objects_key_key" ON "stored_objects"("key");

-- CreateIndex
CREATE INDEX "stored_objects_organizationId_idx" ON "stored_objects"("organizationId");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
