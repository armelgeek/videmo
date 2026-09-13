-- CreateTable
CREATE TABLE "render_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "output_key" TEXT,
    "error" TEXT,
    "heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "reset_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "render_jobs_status_heartbeat_at_idx" ON "render_jobs"("status", "heartbeat_at");

-- CreateIndex
CREATE INDEX "render_jobs_user_id_status_idx" ON "render_jobs"("user_id", "status");

-- CreateIndex
CREATE INDEX "render_jobs_created_at_idx" ON "render_jobs"("created_at");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets"("reset_at");

-- CreateIndex
CREATE INDEX "processed_webhook_events_claimed_at_idx" ON "processed_webhook_events"("claimed_at");
