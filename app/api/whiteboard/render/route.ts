import { NextRequest, NextResponse } from "next/server";
import { assertExportResolution, assertVideoDuration } from "@/lib/billing/org-usage";
import { getOrgPlan } from "@/lib/billing/plan-gating";
import { premiumStylesIn } from "@/lib/whiteboard-animation/style-tiers";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { billingErrorResponse } from "@/lib/billing/with-credits";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse, type Viewer } from "@/lib/video-project/session";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StorageNotConfiguredError,
  buildRenderKey,
} from "@/lib/storage/object-storage";
import { getObjectStorage } from "@/lib/storage/s3-storage";
import {
  renderRequestSchema,
  resolveExportSize,
} from "@/lib/whiteboard-animation/server/render-request";
import {
  type RenderPatch,
  attachChild,
  finalizeRenderJob,
  reportRenderProgress,
  reserveRenderJob,
  takeExpiredRenders,
} from "@/lib/whiteboard-animation/server/render-store";
import { notifyRenderReady } from "@/lib/whiteboard-animation/server/render-notify";

/** Concurrent renders across the whole fleet: state lives in the DB, shared. */
const MAX_CONCURRENT_RENDERS = Number(process.env.MAX_CONCURRENT_RENDERS) || 2;
/** Renders on THIS instance; each one takes a full CPU core. */
const MAX_RENDERS_PER_INSTANCE = Number(process.env.MAX_RENDERS_PER_INSTANCE) || 2;
const MAX_RENDERS_PER_USER = 1;
/** An exported video stays downloadable for 24 h, then leaves the bucket. */
const RENDER_TTL_MS = 24 * 60 * 60 * 1000;
/** Heartbeat: without it for STALE_AFTER_MS, the job is considered dead. */
const HEARTBEAT_MS = 30_000;
/** Writing every progress update to the DB would mean one query per frame. */
const PROGRESS_WRITE_MS = 1000;

// The video is only written here during the render, then moves to the bucket:
// another instance must be able to serve it, and the disk no longer fills up.
const LOCAL_DIR =
  process.env.RENDER_OUTPUT_DIR || join(tmpdir(), "whiteboard-renders");

// The worker is a real file on disk, not a bundle module.
//
// spawn rather than fork: Turbopack STATICALLY analyses fork()'s first argument
// and tries to resolve it as an import, which breaks the build
// ("server relative imports are not implemented yet"). With spawn, the path is
// just a command-line argument. The 'ipc' channel provides child.send() and
// messages, so the worker protocol is unchanged.
const WORKER = join(
  process.cwd(),
  "lib/whiteboard-animation/server/render-worker.js",
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { projectDurationMs } = require("../../../../lib/whiteboard-animation/lib/project") as {
  projectDurationMs: (project: unknown) => number;
};

const logError = (context: string) => (error: unknown) =>
  console.error(`[render] ${context}:`, error);

/** Removes expired videos from the bucket. Off the request path. */
async function purgeExpiredRenders() {
  const storage = getObjectStorage();
  for (const job of await takeExpiredRenders(RENDER_TTL_MS)) {
    if (job.outputKey) await storage.delete(job.outputKey).catch(logError("purge"));
  }
}

export async function POST(request: NextRequest) {
  let viewer: Viewer;
  try {
    viewer = await requireViewer();
  } catch (error) {
    return toErrorResponse(error);
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

  // Only a project the viewer can read may be attached; otherwise it would leak into their list.
  if (parsed.data.projectId) {
    try {
      await requireProjectAccess(parsed.data.projectId, viewer, "read");
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  if (viewer.organizationId) {
    try {
      await assertExportResolution(
        viewer.organizationId,
        Number.parseInt(parsed.data.quality, 10),
      );
      await assertVideoDuration(viewer.organizationId, projectDurationMs(parsed.data.project));
    } catch (error) {
      const billing = billingErrorResponse(error);
      if (billing) return billing;
      throw error;
    }
  }

  const plan = viewer.organizationId ? await getOrgPlan(viewer.organizationId) : null;

  const premiumStyles = premiumStylesIn(parsed.data.project);
  if (premiumStyles.length > 0 && plan?.features.premium_templates !== true) {
    return NextResponse.json(
      {
        error: `${premiumStyles.join(", ")} ${premiumStyles.length === 1 ? "is a Pro drawing style" : "are Pro drawing styles"}. Switch to a free style or upgrade to export.`,
        code: "feature_unavailable",
        feature: "premium_templates",
        styles: premiumStyles,
      },
      { status: 403 },
    );
  }

  const watermark = plan?.features.remove_watermark === true ? null : `Made with ${appConfig.name}`;
  const brandLogoUrl =
    plan?.features.custom_branding === true && viewer.organizationId
      ? ((
          await prisma.organization.findUnique({
            where: { id: viewer.organizationId },
            select: { logo: true },
          })
        )?.logo ?? null)
      : null;

  let storage: ReturnType<typeof getObjectStorage>;
  try {
    storage = getObjectStorage();
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return NextResponse.json(
        { error: error.message, missing: error.missing },
        { status: 503 },
      );
    }
    throw error;
  }

  void purgeExpiredRenders().catch(logError("purge"));

  const userId = viewer.userId;
  const job = await reserveRenderJob(
    userId,
    {
      perUser: MAX_RENDERS_PER_USER,
      global: MAX_CONCURRENT_RENDERS,
      perInstance: MAX_RENDERS_PER_INSTANCE,
    },
    parsed.data.projectId ?? null,
  );
  if (job === "user") {
    return NextResponse.json(
      { error: "Un export est deja en cours. Attendez sa fin pour en lancer un autre." },
      { status: 429 },
    );
  }
  if (job === "global") {
    return NextResponse.json(
      { error: "Le serveur traite deja d'autres exports. Reessayez dans une minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const { width, height } = resolveExportSize(
    parsed.data.quality,
    parsed.data.aspectRatio,
  );

  mkdirSync(LOCAL_DIR, { recursive: true });
  const outputPath = join(LOCAL_DIR, `${job.id}.mp4`);

  const child = spawn(process.execPath, [WORKER], {
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });
  attachChild(job.id, child);

  const heartbeat = setInterval(() => {
    void reportRenderProgress(job.id, null).catch(logError("heartbeat"));
  }, HEARTBEAT_MS);

  // Has a terminal message arrived? Since process.send is async, a 'done' can
  // be lost if the worker exits before flushing it. The job then stayed stuck
  // on its last progress — seen at 88% while the video was complete on disk.
  let finished = false;
  let lastProgressWrite = 0;

  const finish = (patch: RenderPatch) => {
    finished = true;
    clearInterval(heartbeat);
    rmSync(outputPath, { force: true });
    void finalizeRenderJob(job.id, patch).catch(logError("finalize"));
  };

  const deliver = async () => {
    finished = true;
    clearInterval(heartbeat);
    try {
      // Cancelled during the last seconds: nothing to send.
      if (!(await reportRenderProgress(job.id, 100))) return;
      const outputKey = buildRenderKey(userId, job.id);
      await storage.putFile({ key: outputKey, path: outputPath, contentType: "video/mp4" });
      await finalizeRenderJob(job.id, { status: "done", progress: 100, outputKey });
      void notifyRenderReady({
        userId,
        jobId: job.id,
        projectId: parsed.data.projectId ?? null,
        expiryHours: RENDER_TTL_MS / (60 * 60 * 1000),
      }).catch(logError("notify"));
    } catch (error) {
      logError("upload")(error);
      await finalizeRenderJob(job.id, {
        status: "error",
        error: "La video est prete mais n'a pas pu etre enregistree",
      }).catch(logError("finalize"));
    } finally {
      rmSync(outputPath, { force: true });
    }
  };

  child.on("message", (m: unknown) => {
    const msg = m as { type?: string; value?: number; message?: string };
    if (msg?.type === "progress") {
      const now = Date.now();
      if (now - lastProgressWrite >= PROGRESS_WRITE_MS) {
        lastProgressWrite = now;
        void reportRenderProgress(job.id, msg.value ?? 0).catch(logError("progress"));
      }
    }
    if (msg?.type === "done" && !finished) {
      void deliver();
    }
    if (msg?.type === "error" && !finished) {
      finish({ status: "error", error: msg.message ?? null });
    }
  });

  // WITHOUT this handler, a spawn failure KILLS THE SERVER: an 'error' with no
  // listener is rethrown as an exception by EventEmitter, outside any request
  // stack, so out of reach of a try/catch here. A missing worker file (a build
  // that doesn't copy lib/) or the OS refusing another process under load
  // (EAGAIN) is enough to bring all of Next down.
  child.on("error", (err) => {
    if (finished) return;
    finish({ status: "error", error: `Worker impossible a lancer : ${err.message}` });
  });

  child.on("exit", (code, signal) => {
    if (finished) return;

    // The worker left without concluding. The disk decides: a non-empty file
    // means ffmpeg finished, and the user is entitled to their video even if
    // the message was lost.
    const completed =
      code === 0 && existsSync(outputPath) && statSync(outputPath).size > 0;

    if (completed) {
      void deliver();
      return;
    }
    finish({
      status: "error",
      error: signal
        ? `Rendu interrompu (${signal})`
        : `Worker sorti avec le code ${code} sans produire de video`,
    });
  });

  child.send({
    project: parsed.data.project,
    width,
    height,
    fps: 30,
    outputPath,
    watermark,
    brandLogoUrl,
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
