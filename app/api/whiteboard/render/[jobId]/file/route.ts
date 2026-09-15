import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getObjectStorage } from "@/lib/storage/s3-storage";
import { getRenderJob } from "@/lib/whiteboard-animation/server/render-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await getRenderJob(jobId, session.user.id);
  if (!job || job.status !== "done" || !job.outputKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Relue depuis le bac, pas depuis le disque : n'importe quelle instance peut
  // servir la video, pas seulement celle qui l'a rendue. Diffusee en flux, elle
  // ne transite jamais entiere par la memoire.
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
