import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { fork } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  renderRequestSchema,
  resolveExportSize,
} from "@/lib/whiteboard-animation/server/render-request";
import {
  attachChild,
  createRenderJob,
  updateRenderJob,
} from "@/lib/whiteboard-animation/server/render-store";

// Hors de public/ : Next y sert tout fichier sans aucun controle, donc la video
// d'un utilisateur serait telechargeable par quiconque devine l'URL.
const OUTPUT_DIR =
  process.env.RENDER_OUTPUT_DIR || join(process.cwd(), ".renders");

// fork() exige un chemin reel a l'execution : le worker est un .js resolu
// depuis la racine, pas un module du bundle.
const WORKER = join(
  process.cwd(),
  "lib/whiteboard-animation/server/render-worker.js",
);

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requete invalide" },
      { status: 400 },
    );
  }

  const parsed = renderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { width, height } = resolveExportSize(
    parsed.data.quality,
    parsed.data.aspectRatio,
  );
  const job = createRenderJob(session.user.id);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = join(OUTPUT_DIR, `${job.id}.mp4`);

  const child = fork(WORKER, { stdio: "pipe" });
  attachChild(job.id, child);
  updateRenderJob(job.id, { status: "rendering" });

  child.on("message", (m: unknown) => {
    const msg = m as { type?: string; value?: number; message?: string };
    if (msg?.type === "progress") {
      updateRenderJob(job.id, { progress: msg.value ?? 0 });
    }
    if (msg?.type === "done") {
      updateRenderJob(job.id, { status: "done", progress: 100, outputPath });
    }
    if (msg?.type === "error") {
      updateRenderJob(job.id, { status: "error", error: msg.message ?? null });
    }
  });

  child.on("exit", (code) => {
    // Sortie non nulle sans message d'erreur : tue, ou plante sans avoir pu
    // rendre compte. Sans ce filet le job resterait "rendering" pour toujours.
    if (code !== 0) {
      updateRenderJob(job.id, {
        status: "error",
        error: `Worker sorti avec le code ${code}`,
      });
    }
  });

  child.send({
    project: parsed.data.project,
    width,
    height,
    fps: 30,
    outputPath,
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
