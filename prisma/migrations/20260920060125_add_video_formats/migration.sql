-- CreateTable
CREATE TABLE "VideoFormat" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "organizationId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "label" VARCHAR(120) NOT NULL,
    "hint" VARCHAR(255) NOT NULL,
    "family" VARCHAR(32) NOT NULL DEFAULT 'explainer',
    "thumbnailUrl" TEXT,
    "paragraphs" INTEGER NOT NULL,
    "structure" JSONB NOT NULL,
    "defaultTone" VARCHAR(64) NOT NULL,
    "breakdownRules" JSONB NOT NULL,
    "visual" JSONB NOT NULL,
    "character" JSONB,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoFormat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoFormat_organizationId_deletedAt_idx" ON "VideoFormat"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "VideoFormat_key_idx" ON "VideoFormat"("key");

-- AddForeignKey
ALTER TABLE "VideoFormat" ADD CONSTRAINT "VideoFormat_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
