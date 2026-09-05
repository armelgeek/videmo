-- 1. The active organization, nullable: no existing session is invalidated.
ALTER TABLE "Session" ADD COLUMN "activeOrganizationId" TEXT;

ALTER TABLE "Organization" DROP CONSTRAINT "Organization_ownerId_fkey";

-- 2. Backfill BEFORE dropping. Any organization whose owner has no member row
--    gets one, built from ownerId. A no-op if the data is already consistent.
INSERT INTO "OrganizationMember" ("id", "organizationId", "userId", "role", "joinedAt")
SELECT gen_random_uuid()::text, o."id", o."ownerId", 'owner', o."createdAt"
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrganizationMember" m
  WHERE m."organizationId" = o."id" AND m."role" = 'owner'
);

-- 3. The information now lives in OrganizationMember.
ALTER TABLE "Organization" DROP COLUMN "ownerId";

-- 4. A table no code ever wrote to: replaced with the plugin's shape.
DROP TABLE "OrganizationInvitation";

CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationInvitation_email_idx" ON "OrganizationInvitation"("email");
CREATE INDEX "OrganizationInvitation_organizationId_idx" ON "OrganizationInvitation"("organizationId");

ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Earlier drift: models present in the schema but never migrated.
ALTER TABLE "Account" ADD COLUMN "issuer" TEXT;

CREATE TABLE "TimelineClip" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "start" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "offset" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineClip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "narrativeRole" VARCHAR(255),
    "subtitle" TEXT,
    "sequence" INTEGER,
    "region" JSONB NOT NULL,
    "startMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "reveal" JSONB NOT NULL,
    "handPath" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimelineClip_trackId_idx" ON "TimelineClip"("trackId");
CREATE INDEX "Annotation_clipId_idx" ON "Annotation"("clipId");

ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "TimelineClip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
