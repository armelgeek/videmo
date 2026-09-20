-- CreateTable
CREATE TABLE "WhiteboardStyle" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "organizationId" TEXT,
    "label" VARCHAR(120) NOT NULL,
    "hint" VARCHAR(255) NOT NULL,
    "animStyle" VARCHAR(40) NOT NULL,
    "handStyle" VARCHAR(20) NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhiteboardStyle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhiteboardStyle_organizationId_deletedAt_idx" ON "WhiteboardStyle"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "WhiteboardStyle_key_idx" ON "WhiteboardStyle"("key");

-- AddForeignKey
ALTER TABLE "WhiteboardStyle" ADD CONSTRAINT "WhiteboardStyle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
