/*
  Warnings:

  - Added the required column `videoProjectId` to the `TimelineClip` table without a default value. This is not possible if the table is not empty.

*/
-- Ces lignes n'ont jamais eu de propriétaire : aucun écran ne les crée, il n'y
-- a donc rien à conserver. Annotation part en cascade.
DELETE FROM "TimelineClip";

-- AlterTable
ALTER TABLE "TimelineClip" ADD COLUMN     "videoProjectId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "VideoProject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "step" TEXT NOT NULL DEFAULT 'prompt',
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "params" JSONB NOT NULL,
    "script" JSONB NOT NULL,
    "panels" JSONB NOT NULL,
    "whiteboardConfig" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "lockedById" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoProject_organizationId_deletedAt_updatedAt_idx" ON "VideoProject"("organizationId", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "VideoProject_lockExpiresAt_idx" ON "VideoProject"("lockExpiresAt");

-- CreateIndex
CREATE INDEX "TimelineClip_videoProjectId_idx" ON "TimelineClip"("videoProjectId");

-- AddForeignKey
ALTER TABLE "TimelineClip" ADD CONSTRAINT "TimelineClip_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProject" ADD CONSTRAINT "VideoProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProject" ADD CONSTRAINT "VideoProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProject" ADD CONSTRAINT "VideoProject_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
