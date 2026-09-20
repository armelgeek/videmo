-- The drawing look now lives in WhiteboardStyle, and "family" only ever meant
-- "has a recurring character". Carry that over before the columns go, or the
-- story format would lose its character.
ALTER TABLE "VideoFormat" ADD COLUMN "usesCharacter" BOOLEAN NOT NULL DEFAULT false;

UPDATE "VideoFormat" SET "usesCharacter" = ("character" IS NOT NULL OR "family" = 'story');

ALTER TABLE "VideoFormat" DROP COLUMN "character",
DROP COLUMN "family",
DROP COLUMN "visual";
