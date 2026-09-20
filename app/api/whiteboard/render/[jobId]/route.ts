import { requireViewer, toErrorResponse, type Viewer } from "@/lib/video-project/session";
import { NextRequest, NextResponse } from "next/server";
import {
  cancelRenderJob,
  getRenderJob,
} from "@/lib/whiteboard-animation/server/render-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  let viewer: Viewer;
  try {
    viewer = await requireViewer();
  } catch (error) {
    return toErrorResponse(error);
  }

  const { jobId } = await params;
  const job = await getRenderJob(jobId, viewer.userId);
  // 404 rather than 403 on someone else's job: a 403 would confirm it exists.
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  let viewer: Viewer;
  try {
    viewer = await requireViewer();
  } catch (error) {
    return toErrorResponse(error);
  }

  const { jobId } = await params;
  // An already finished job refuses cancellation: nothing to cancel, and its video
  // stays downloadable.
  if (!(await cancelRenderJob(jobId, viewer.userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ cancelled: true });
}
