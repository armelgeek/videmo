-- AlterTable
ALTER TABLE "render_jobs" ADD COLUMN "project_id" TEXT;

-- CreateIndex
CREATE INDEX "render_jobs_user_id_project_id_status_idx" ON "render_jobs"("user_id", "project_id", "status");
