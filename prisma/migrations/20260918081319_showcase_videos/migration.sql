-- CreateTable
CREATE TABLE "showcase_videos" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(400),
    "sector" VARCHAR(40) NOT NULL,
    "customer" VARCHAR(120),
    "videoUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "aspectRatio" VARCHAR(8) NOT NULL DEFAULT '16:9',
    "durationSec" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showcase_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "showcase_videos_published_sector_idx" ON "showcase_videos"("published", "sector");

-- CreateIndex
CREATE INDEX "showcase_videos_sortOrder_idx" ON "showcase_videos"("sortOrder");
