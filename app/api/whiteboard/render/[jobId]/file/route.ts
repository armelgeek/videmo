import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createReadStream, existsSync, statSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getRenderJob } from "@/lib/whiteboard-animation/server/render-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = getRenderJob(jobId, session.user.id);
  if (
    !job ||
    job.status !== "done" ||
    !job.outputPath ||
    !existsSync(job.outputPath)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Diffuse plutot que de charger : une video de plusieurs centaines de Mo ne
  // doit pas transiter par un Buffer en memoire.
  const stream = Readable.toWeb(
    createReadStream(job.outputPath),
  ) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(statSync(job.outputPath).size),
      "Content-Disposition": `attachment; filename="whiteboard-${jobId}.mp4"`,
    },
  });
}
