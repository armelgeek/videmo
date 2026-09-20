-- The first cut paired a hand sprite with an animation engine, which is how the
-- pen moves, not how the drawings look. Only the eight seeded rows are lost.

-- DropForeignKey
ALTER TABLE "WhiteboardStyle" DROP CONSTRAINT "WhiteboardStyle_organizationId_fkey";

-- DropTable
DROP TABLE "WhiteboardStyle";

-- CreateTable
CREATE TABLE "VisualStyle" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "organizationId" TEXT,
    "label" VARCHAR(120) NOT NULL,
    "hint" VARCHAR(255) NOT NULL,
    "artDirection" TEXT NOT NULL,
    "accentColors" JSONB NOT NULL,
    "vocabulary" JSONB NOT NULL,
    "labels" VARCHAR(16) NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisualStyle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisualStyle_organizationId_deletedAt_idx" ON "VisualStyle"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "VisualStyle_key_idx" ON "VisualStyle"("key");

-- AddForeignKey
ALTER TABLE "VisualStyle" ADD CONSTRAINT "VisualStyle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

