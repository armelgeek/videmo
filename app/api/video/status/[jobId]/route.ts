import { NextRequest, NextResponse } from "next/server";
import { videoStore } from "@/lib/video-generation/store";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  let viewer;
  try {
    viewer = await requireViewer();
  } catch (error) {
    return toErrorResponse(error);
  }

  const { jobId } = await params;
  const job = videoStore.getJobForOwner(jobId, viewer.userId);

  if (!job) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
