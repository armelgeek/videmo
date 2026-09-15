import { NextRequest, NextResponse } from "next/server";
import { assertExportResolution } from "@/lib/billing/org-usage";
import { billingErrorResponse } from "@/lib/billing/with-credits";
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

/** Rendus simultanes sur tout le parc : l'etat est en base, partage. */
const MAX_CONCURRENT_RENDERS = Number(process.env.MAX_CONCURRENT_RENDERS) || 2;
/** Rendus sur CETTE instance ; chacun occupe un coeur CPU entier. */
const MAX_RENDERS_PER_INSTANCE = Number(process.env.MAX_RENDERS_PER_INSTANCE) || 2;
const MAX_RENDERS_PER_USER = 1;
/** Une video exportee reste telechargeable 24 h, puis quitte le bac. */
const RENDER_TTL_MS = 24 * 60 * 60 * 1000;
/** Signal de vie : sans lui pendant STALE_AFTER_MS, le job est tenu pour mort. */
const HEARTBEAT_MS = 30_000;
/** Ecrire chaque progression en base ferait une requete par frame. */
const PROGRESS_WRITE_MS = 1000;

// La video n'est ecrite ici que le temps du rendu, puis part dans le bac : une
// autre instance doit pouvoir la servir, et le disque ne se remplit plus.
const LOCAL_DIR =
  process.env.RENDER_OUTPUT_DIR || join(tmpdir(), "whiteboard-renders");

// Le worker est un fichier reel sur le disque, pas un module du bundle.
//
// spawn et non fork : Turbopack analyse STATIQUEMENT le premier argument de
// fork() et tente de le resoudre comme un import, ce qui fait echouer le build
// ("server relative imports are not implemented yet"). Passe a spawn, le chemin
// n'est plus qu'un argument de ligne de commande. Le canal 'ipc' rend
// child.send() et les messages, donc le protocole du worker est inchange.
const WORKER = join(
  process.cwd(),
  "lib/whiteboard-animation/server/render-worker.js",
);

const logError = (context: string) => (error: unknown) =>
  console.error(`[render] ${context}:`, error);

/** Retire du bac les videos expirees. Hors du chemin de la requete. */
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

  if (viewer.organizationId) {
    try {
      await assertExportResolution(
        viewer.organizationId,
        Number.parseInt(parsed.data.quality, 10),
      );
    } catch (error) {
      const billing = billingErrorResponse(error);
      if (billing) return billing;
      throw error;
    }
  }

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
  const job = await reserveRenderJob(userId, {
    perUser: MAX_RENDERS_PER_USER,
    global: MAX_CONCURRENT_RENDERS,
    perInstance: MAX_RENDERS_PER_INSTANCE,
  });
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

  // Un message terminal est-il arrive ? process.send etant asynchrone, un
  // 'done' peut se perdre si le worker sort avant de l'avoir vide. Le job
  // restait alors fige sur sa derniere progression — observe a 88 % alors que
  // la video etait complete sur le disque.
  let conclu = false;
  let lastProgressWrite = 0;

  const conclure = (patch: RenderPatch) => {
    conclu = true;
    clearInterval(heartbeat);
    rmSync(outputPath, { force: true });
    void finalizeRenderJob(job.id, patch).catch(logError("finalize"));
  };

  const livrer = async () => {
    conclu = true;
    clearInterval(heartbeat);
    try {
      // Annule pendant les dernieres secondes : rien a envoyer.
      if (!(await reportRenderProgress(job.id, 100))) return;
      const outputKey = buildRenderKey(userId, job.id);
      await storage.putFile({ key: outputKey, path: outputPath, contentType: "video/mp4" });
      await finalizeRenderJob(job.id, { status: "done", progress: 100, outputKey });
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
    if (msg?.type === "done" && !conclu) {
      void livrer();
    }
    if (msg?.type === "error" && !conclu) {
      conclure({ status: "error", error: msg.message ?? null });
    }
  });

  // SANS ce handler, un echec de spawn TUE LE SERVEUR : un 'error' sans
  // ecouteur est reemis en exception par EventEmitter, hors de toute pile de
  // requete, donc hors d'atteinte d'un try/catch ici. Il suffit que le fichier
  // du worker manque (un build qui ne copie pas lib/), ou que le systeme
  // refuse un process de plus sous charge (EAGAIN), pour que tout Next tombe.
  child.on("error", (err) => {
    if (conclu) return;
    conclure({ status: "error", error: `Worker impossible a lancer : ${err.message}` });
  });

  child.on("exit", (code, signal) => {
    if (conclu) return;

    // Le worker est parti sans conclure. Le disque tranche : un fichier non
    // vide signifie que ffmpeg est alle au bout, et l'utilisateur a droit a sa
    // video meme si le message s'est perdu.
    const abouti =
      code === 0 && existsSync(outputPath) && statSync(outputPath).size > 0;

    if (abouti) {
      void livrer();
      return;
    }
    conclure({
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
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
