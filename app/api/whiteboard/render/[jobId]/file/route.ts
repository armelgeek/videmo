import { requireViewer, toErrorResponse, type Viewer } from "@/lib/video-project/session";
import { NextRequest, NextResponse } from "next/server";
import { getObjectStorage } from "@/lib/storage/s3-storage";
import { getRenderJob } from "@/lib/whiteboard-animation/server/render-store";

export async function GET(
  request: NextRequest,
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
  if (!job || job.status !== "done" || !job.outputKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Read back from the bucket, not from disk: any instance can serve the video,
  // not just the one that rendered it. Streamed, it never sits whole in memory.
  const object = await getObjectStorage().getStream(job.outputKey);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(object.body, {
    headers: {
      "Content-Type": "video/mp4",
      ...(object.contentLength !== null
        ? { "Content-Length": String(object.contentLength) }
        : {}),
      // ?inline=1 lets a <video> element play it in the page instead of forcing a download.
      "Content-Disposition": `${
        request.nextUrl.searchParams.get("inline") === "1" ? "inline" : "attachment"
      }; filename="whiteboard-${jobId}.mp4"`,
    },
  });
}
