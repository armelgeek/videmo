# Export vidéo serveur du whiteboard — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'export simulé du storyboard par un vrai rendu vidéo serveur, hors ligne, image par image.

**Architecture:** Le renderer de sketchpilot (jsdom + node-canvas + ffmpeg `image2pipe`) est porté dans `lib/whiteboard-animation/server/`. Une route Next crée un job et `fork()` un worker Node dédié ; l'UI interroge la progression et peut annuler en tuant le process. Les mp4 sont écrits hors de `public/` et servis par une route authentifiée.

**Tech Stack:** Node.js, jsdom, node-canvas (`canvas`), fluent-ffmpeg, Next.js route handlers, Zod, Vitest.

**Pourquoi jsdom :** il donne au moteur le `window` et le `document` qu'il
attend, donc le moteur navigateur tourne sans modification. C'est ce qui rend
l'existant reutilisable. jsdom ne dessine pas : sans le paquet `canvas`,
`getContext('2d')` rend `null` et le moteur trace dans le vide. Les deux sont
complementaires, comme dans sketchpilot.

**Repli connu :** si la compilation native de `canvas` devient penible en
Docker, `@napi-rs/canvas` expose la meme API (`createCanvas`, `loadImage`,
`toBuffer`) avec des binaires preconstruits et aucune lib systeme. Le renderer
surcharge `document.createElement` pour fournir ses propres canvas, donc la
bibliotheque de dessin se remplace sans toucher au reste. Le test de fumee de
la tache 4 dirait immediatement si le rendu tient.

**Spec:** `docs/superpowers/specs/2026-09-04-whiteboard-export-serveur-design.md`

## Global Constraints

- Le moteur reste figé au 1× fidèle : `speed = 40`. Aucun réglage d'UI ne pilote l'horloge du rendu.
- Un JSDOM **neuf par scène**. Ne jamais réutiliser un `window` d'une scène à l'autre.
- La frame N est l'état **après** N ticks ; la frame 0 est l'état initial, avant le moindre trait.
- `fps = 30`, non exposé dans l'UI.
- Les vidéos sont écrites dans `RENDER_OUTPUT_DIR` (défaut `.renders/`), **jamais** dans `public/`.
- Un job d'un autre utilisateur répond **404**, jamais 403.
- Le worker est du JavaScript nu : il ne charge pas de TypeScript.
- Commits en conventional commits, **sans** trailer `Co-Authored-By`.
- Source de vérité du renderer : `~/dev/Hayzar/SAAS/sketchpilot/server/canvas-renderer.js`. On le porte, on ne le réécrit pas.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `lib/whiteboard-animation/server/canvas-renderer.js` | Port du renderer. Rend les frames et encode. Ne connaît ni HTTP ni Next. |
| `lib/whiteboard-animation/server/frame-sink.js` | Émission des frames vers ffmpeg avec insertion des transitions, à mémoire constante. |
| `lib/whiteboard-animation/server/render-worker.js` | Process forké. IPC ↔ renderer. |
| `lib/whiteboard-animation/server/render-store.ts` | Jobs en mémoire + référence du child process. |
| `lib/whiteboard-animation/server/to-render-project.ts` | Store storyboard → `project` du renderer. Pure. |
| `lib/whiteboard-animation/server/render-request.ts` | Schéma Zod + résolution `"720p"/"1080p"` × ratio → pixels. |
| `app/api/whiteboard/render/route.ts` | POST : crée le job, fork. |
| `app/api/whiteboard/render/[jobId]/route.ts` | GET progression, DELETE annulation. |
| `app/api/whiteboard/render/[jobId]/file/route.ts` | GET le mp4, session vérifiée. |
| `app/(protected)/storyboard/page.tsx:1951` | Branchement de l'ExportModal. |

---

### Task 1: Résolution d'export

**Files:**
- Create: `lib/whiteboard-animation/server/render-request.ts`
- Test: `lib/whiteboard-animation/server/render-request.test.ts`

**Interfaces:**
- Produces: `resolveExportSize(quality: "720p" | "1080p", aspectRatio: "16:9" | "9:16" | "1:1"): { width: number; height: number }` et `renderRequestSchema` (Zod).

La modale raisonne en `720p`/`1080p`, le renderer en pixels. La conversion respecte le ratio du projet : le libellé désigne le **petit côté** en portrait, le grand en paysage.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { resolveExportSize } from "./render-request";

describe("resolveExportSize", () => {
  it("rend du paysage en 16:9", () => {
    expect(resolveExportSize("720p", "16:9")).toEqual({ width: 1280, height: 720 });
    expect(resolveExportSize("1080p", "16:9")).toEqual({ width: 1920, height: 1080 });
  });

  it("rend du portrait en 9:16, sans transposer le libelle", () => {
    expect(resolveExportSize("1080p", "9:16")).toEqual({ width: 1080, height: 1920 });
    expect(resolveExportSize("720p", "9:16")).toEqual({ width: 720, height: 1280 });
  });

  it("rend un carre en 1:1", () => {
    expect(resolveExportSize("1080p", "1:1")).toEqual({ width: 1080, height: 1080 });
  });

  it("ne rend que des dimensions paires, exigees par yuv420p", () => {
    for (const q of ["720p", "1080p"] as const) {
      for (const r of ["16:9", "9:16", "1:1"] as const) {
        const { width, height } = resolveExportSize(q, r);
        expect(width % 2).toBe(0);
        expect(height % 2).toBe(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/server/render-request.test.ts`
Expected: FAIL — `Failed to resolve import "./render-request"`

- [ ] **Step 3: Write minimal implementation**

```ts
import { z } from "zod";

export type ExportQuality = "720p" | "1080p";
export type ExportAspect = "16:9" | "9:16" | "1:1";

/** Le libelle designe le PETIT cote : 1080p en 9:16 fait 1080x1920. */
const PETIT_COTE: Record<ExportQuality, number> = { "720p": 720, "1080p": 1080 };

const RATIO: Record<ExportAspect, [number, number]> = {
  "16:9": [16, 9],
  "9:16": [9, 16],
  "1:1": [1, 1],
};

/** yuv420p sous-echantillonne la chroma par 2 : une dimension impaire est refusee. */
const pair = (n: number) => (n % 2 === 0 ? n : n + 1);

export function resolveExportSize(
  quality: ExportQuality,
  aspectRatio: ExportAspect,
): { width: number; height: number } {
  const base = PETIT_COTE[quality];
  const [rw, rh] = RATIO[aspectRatio];
  const petit = Math.min(rw, rh);
  return {
    width: pair(Math.round((base * rw) / petit)),
    height: pair(Math.round((base * rh) / petit)),
  };
}

export const renderRequestSchema = z.object({
  quality: z.enum(["720p", "1080p"]),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  project: z.object({
    scenes: z.array(z.any()).min(1),
    narration: z.any().optional(),
    animStyle: z.string().optional(),
    hand: z.string().optional(),
    handSpeed: z.number().optional(),
    tileSlider: z.number().optional(),
  }),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/server/render-request.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/server/render-request.ts lib/whiteboard-animation/server/render-request.test.ts
git commit -m "feat(export): resolution d'export deduite de la qualite et du ratio"
```

---

### Task 2: Émission des frames à mémoire constante

**Files:**
- Create: `lib/whiteboard-animation/server/frame-sink.js`
- Test: `lib/whiteboard-animation/server/frame-sink.test.ts`

**Interfaces:**
- Produces: `createFrameSink({ write, makeTransitionFrames })` → `{ sceneFrame(buf, sceneIdx), endScene(sceneIdx, transitionFrameCount), finish() }`.
  - `write(buf)` : écrit une frame dans le flux ffmpeg.
  - `makeTransitionFrames(derniere, entrante, n)` : rend `n` frames de fondu.

`renderProjectFrames` accumule aujourd'hui toutes les frames (`frames.push`) — ~900 buffers PNG pour 30 s en 1080p. L'accumulation n'existe que parce qu'une transition a besoin de la dernière frame de la scène N et de la première de la N+1. Il suffit d'en retenir deux.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createFrameSink } = require("./frame-sink");

const buf = (n: string) => Buffer.from(n);

function harness() {
  const written: string[] = [];
  const sink = createFrameSink({
    write: (b: Buffer) => written.push(b.toString()),
    makeTransitionFrames: (a: Buffer, b: Buffer, n: number) =>
      Array.from({ length: n }, (_, i) => buf(`T(${a}->${b})${i}`)),
  });
  return { sink, written };
}

describe("createFrameSink", () => {
  it("ecrit une scene unique dans l'ordre", () => {
    const { sink, written } = harness();
    sink.sceneFrame(buf("a0"), 0);
    sink.sceneFrame(buf("a1"), 0);
    sink.endScene(0, 0);
    sink.finish();
    expect(written).toEqual(["a0", "a1"]);
  });

  it("insere le fondu entre les deux scenes", () => {
    const { sink, written } = harness();
    sink.sceneFrame(buf("a0"), 0);
    sink.sceneFrame(buf("a1"), 0);
    sink.endScene(0, 2);
    sink.sceneFrame(buf("b0"), 1);
    sink.sceneFrame(buf("b1"), 1);
    sink.endScene(1, 0);
    sink.finish();
    expect(written).toEqual(["a0", "a1", "T(a1->b0)0", "T(a1->b0)1", "b0", "b1"]);
  });

  it("enchaine sans fondu quand la transition est nulle", () => {
    const { sink, written } = harness();
    sink.sceneFrame(buf("a0"), 0);
    sink.endScene(0, 0);
    sink.sceneFrame(buf("b0"), 1);
    sink.endScene(1, 0);
    sink.finish();
    expect(written).toEqual(["a0", "b0"]);
  });

  it("ne retient jamais plus de deux frames", () => {
    const { sink } = harness();
    for (let i = 0; i < 500; i++) sink.sceneFrame(buf(`a${i}`), 0);
    sink.endScene(0, 3);
    for (let i = 0; i < 500; i++) sink.sceneFrame(buf(`b${i}`), 1);
    expect(sink.heldFrames()).toBeLessThanOrEqual(2);
    sink.endScene(1, 0);
    sink.finish();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/server/frame-sink.test.ts`
Expected: FAIL — module introuvable

- [ ] **Step 3: Write minimal implementation**

```js
/**
 * Ecrit les frames dans le flux d'encodage au fil de l'eau, en inserant les
 * fondus entre scenes.
 *
 * Accumuler toutes les frames pour pouvoir fondre coutait ~900 buffers PNG sur
 * 30 s en 1080p. Une transition n'a besoin que de la DERNIERE frame sortante et
 * de la PREMIERE entrante : on n'en retient donc que deux.
 */
function createFrameSink({ write, makeTransitionFrames }) {
  let derniere = null;          // derniere frame de la scene sortante
  let fonduEnAttente = 0;       // frames de fondu dues avant la scene suivante
  let sceneCourante = null;

  return {
    sceneFrame(buf, sceneIdx) {
      // Premiere frame d'une nouvelle scene : le fondu se glisse AVANT elle.
      if (sceneIdx !== sceneCourante) {
        if (fonduEnAttente > 0 && derniere) {
          for (const f of makeTransitionFrames(derniere, buf, fonduEnAttente)) write(f);
        }
        fonduEnAttente = 0;
        sceneCourante = sceneIdx;
      }
      write(buf);
      derniere = buf;
    },

    endScene(_sceneIdx, transitionFrameCount) {
      fonduEnAttente = transitionFrameCount || 0;
    },

    finish() {
      derniere = null;
      fonduEnAttente = 0;
      sceneCourante = null;
    },

    /** Sert au test : le nombre de frames retenues en memoire. */
    heldFrames() {
      return derniere ? 1 : 0;
    },
  };
}

module.exports = { createFrameSink };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/server/frame-sink.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/server/frame-sink.js lib/whiteboard-animation/server/frame-sink.test.ts
git commit -m "feat(export): emission des frames a memoire constante avec fondus"
```

---

### Task 3: Dépendances natives

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts` (ou `next.config.js`)

**Interfaces:**
- Produces: `canvas` et `fluent-ffmpeg` installables et `require`-ables côté serveur.

`canvas` est natif : il compile ou tire un binaire préconstruit, et exige `libcairo`, `libpango`, `libjpeg`. `serverExternalPackages` empêche Next de tenter de le bundler.

- [ ] **Step 1: Installer les dépendances**

```bash
npm install canvas fluent-ffmpeg
npm install --save-dev @types/fluent-ffmpeg
```

- [ ] **Step 2: Vérifier qu'elles se chargent**

```bash
node -e "require('canvas'); require('fluent-ffmpeg'); console.log('OK')"
```
Expected: `OK`. Si `canvas` échoue, installer les libs système :
`sudo apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`

- [ ] **Step 3: Exclure du bundle Next**

Ajouter dans la config Next :

```ts
serverExternalPackages: ["canvas", "fluent-ffmpeg", "jsdom"],
```

- [ ] **Step 4: Vérifier que le build passe**

Run: `npx next build`
Expected: build terminé sans erreur de résolution sur `canvas`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore(export): ajouter canvas et fluent-ffmpeg, hors bundle Next"
```

---

### Task 4: Port du renderer

**Files:**
- Create: `lib/whiteboard-animation/server/canvas-renderer.js`
- Test: `lib/whiteboard-animation/server/canvas-renderer.smoke.test.ts`

**Interfaces:**
- Consumes: `createFrameSink` (Task 2).
- Produces: `renderProjectToVideo(project, outputPath, { width, height, fps, onProgress }): Promise<{ outputPath, plan, frames }>` et `renderAnimationFrames(animationData, { width, height, fps, duration, onFrame })`.

Copier `~/dev/Hayzar/SAAS/sketchpilot/server/canvas-renderer.js` puis appliquer **exactement trois** adaptations :

1. `require('../lib')` → `require('../lib')` reste correct depuis `server/` (il pointe sur `lib/whiteboard-animation/lib`). Vérifier de même `require('../lib/transitions')`.
2. La réécriture des chemins de mains `img.path.replace('images/', '../images/')` devient une résolution vers `public/images/` : `path.join(process.cwd(), 'public', 'images', path.basename(img.path))`.
3. `renderProjectFrames` n'accumule plus : il pousse dans un `createFrameSink` branché sur le `PassThrough` d'ffmpeg.

Ne rien changer d'autre. En particulier, conserver `seekFrame`, le JSDOM par scène, et `speed = 40`.

- [ ] **Step 1: Write the failing smoke test**

```ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderProjectToVideo } = require("./canvas-renderer");

const dir = mkdtempSync(join(tmpdir(), "wb-render-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Une scene minuscule : le but est de prouver que la chaine complete produit un
// mp4 lisible, pas de juger le rendu.
const project = {
  animStyle: "chunkjump",
  hand: "custom1",
  handSpeed: 5,
  speed: 40,
  tileSlider: 30,
  scenes: [
    {
      id: "s1",
      canvasImage: join(process.cwd(), "public", "images", "hand1-720p.png"),
      annotations: [
        { region: { x: 0, y: 0, width: 60, height: 40 }, reveal: { from: 0, to: 200 } },
      ],
    },
  ],
};

describe("renderProjectToVideo (lent : lance ffmpeg)", () => {
  it("produit un mp4 lisible avec le bon nombre d'images", async () => {
    const out = join(dir, "out.mp4");
    const res = await renderProjectToVideo(project, out, {
      width: 128, height: 96, fps: 10,
    });

    expect(existsSync(out)).toBe(true);
    expect(res.frames).toBeGreaterThan(0);

    const probe = execFileSync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=nb_read_packets,width,height",
      "-count_packets", "-of", "csv=p=0", out,
    ]).toString().trim();

    const [w, h, packets] = probe.split(",");
    expect(Number(w)).toBe(128);
    expect(Number(h)).toBe(96);
    expect(Number(packets)).toBe(res.frames);
  }, 120_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/server/canvas-renderer.smoke.test.ts`
Expected: FAIL — module introuvable

- [ ] **Step 3: Porter le fichier**

```bash
cp ~/dev/Hayzar/SAAS/sketchpilot/server/canvas-renderer.js \
   lib/whiteboard-animation/server/canvas-renderer.js
```

Puis appliquer les trois adaptations listées ci-dessus.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/server/canvas-renderer.smoke.test.ts`
Expected: PASS. En cas d'échec, lire le message d'ffmpeg : il est explicite sur un flux vide ou une dimension impaire.

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/server/canvas-renderer.js lib/whiteboard-animation/server/canvas-renderer.smoke.test.ts
git commit -m "feat(export): porter le renderer serveur de sketchpilot"
```

---

### Task 5: Le worker

**Files:**
- Create: `lib/whiteboard-animation/server/render-worker.js`
- Test: `lib/whiteboard-animation/server/render-worker.test.ts`

**Interfaces:**
- Consumes: `renderProjectToVideo` (Task 4).
- Produces: un script forkable. Messages sortants : `{ type: "progress", value: number }`, `{ type: "done", path: string }`, `{ type: "error", message: string }`. Message entrant : `{ project, width, height, fps, outputPath }`.

JavaScript nu : ce process ne sait pas charger de TypeScript.

- [ ] **Step 1: Write the failing test**

```ts
import { fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "wb-worker-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const WORKER = join(process.cwd(), "lib/whiteboard-animation/server/render-worker.js");

function run(message: any): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const child = fork(WORKER, { stdio: "pipe" });
    const recus: any[] = [];
    child.on("message", (m) => recus.push(m));
    child.on("exit", () => resolve(recus));
    child.on("error", reject);
    child.send(message);
  });
}

describe("render-worker", () => {
  it("signale l'erreur et sort en echec sur un projet vide", async () => {
    const recus = await run({
      project: { scenes: [] },
      width: 128, height: 96, fps: 10,
      outputPath: join(dir, "vide.mp4"),
    });
    expect(recus.at(-1)).toMatchObject({ type: "error" });
  }, 60_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/server/render-worker.test.ts`
Expected: FAIL — `render-worker.js` n'existe pas.

- [ ] **Step 3: Write minimal implementation**

```js
/**
 * Process de rendu, forke par la route d'export.
 *
 * Il ne connait ni Next ni HTTP : il recoit un projet deja forme, rend, et
 * rend compte sur IPC. Le tuer EST l'annulation — d'ou l'absence de tout etat
 * a nettoyer ici.
 *
 * JavaScript nu : un process forke ne sait pas charger de TypeScript.
 */
const { renderProjectToVideo } = require('./canvas-renderer');

process.on('message', async (msg) => {
  const { project, width, height, fps, outputPath } = msg || {};
  try {
    const res = await renderProjectToVideo(project, outputPath, {
      width, height, fps,
      onProgress: (value) => process.send?.({ type: 'progress', value }),
    });
    process.send?.({ type: 'done', path: res.outputPath, frames: res.frames });
    process.exit(0);
  } catch (err) {
    process.send?.({ type: 'error', message: err?.message || String(err) });
    process.exit(1);
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/server/render-worker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/server/render-worker.js lib/whiteboard-animation/server/render-worker.test.ts
git commit -m "feat(export): worker de rendu forkable"
```

---

### Task 6: Le job store

**Files:**
- Create: `lib/whiteboard-animation/server/render-store.ts`
- Test: `lib/whiteboard-animation/server/render-store.test.ts`

**Interfaces:**
- Produces:
  - `createRenderJob(userId: string): RenderJob`
  - `getRenderJob(id: string, userId: string): RenderJob | undefined` — rend `undefined` si le job appartient à un autre
  - `attachChild(id: string, child: { kill: () => void }): void`
  - `updateRenderJob(id: string, patch: Partial<RenderJob>): void`
  - `cancelRenderJob(id: string, userId: string): boolean`
  - `RenderJob = { id, userId, status: "pending" | "rendering" | "done" | "error" | "cancelled", progress: number, outputPath: string | null, error: string | null, createdAt: Date }`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachChild, cancelRenderJob, createRenderJob, getRenderJob, updateRenderJob,
} from "./render-store";

describe("render-store", () => {
  it("cree un job en attente, a zero", () => {
    const job = createRenderJob("u1");
    expect(job).toMatchObject({ userId: "u1", status: "pending", progress: 0 });
    expect(job.id).toBeTruthy();
  });

  it("ne rend pas le job d'un autre utilisateur", () => {
    const job = createRenderJob("u1");
    expect(getRenderJob(job.id, "u1")).toBeDefined();
    expect(getRenderJob(job.id, "u2")).toBeUndefined();
  });

  it("rend undefined sur un job inconnu", () => {
    expect(getRenderJob("inexistant", "u1")).toBeUndefined();
  });

  it("met a jour la progression", () => {
    const job = createRenderJob("u1");
    updateRenderJob(job.id, { status: "rendering", progress: 42 });
    expect(getRenderJob(job.id, "u1")).toMatchObject({ status: "rendering", progress: 42 });
  });

  it("annuler tue l'enfant et marque le job", () => {
    const job = createRenderJob("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });
    expect(cancelRenderJob(job.id, "u1")).toBe(true);
    expect(kill).toHaveBeenCalledOnce();
    expect(getRenderJob(job.id, "u1")?.status).toBe("cancelled");
  });

  it("un autre utilisateur ne peut pas annuler", () => {
    const job = createRenderJob("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });
    expect(cancelRenderJob(job.id, "u2")).toBe(false);
    expect(kill).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/server/render-store.test.ts`
Expected: FAIL — module introuvable

- [ ] **Step 3: Write minimal implementation**

```ts
import { randomUUID } from "node:crypto";

export interface RenderJob {
  id: string;
  userId: string;
  status: "pending" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  outputPath: string | null;
  error: string | null;
  createdAt: Date;
}

interface Entree {
  job: RenderJob;
  child: { kill: () => void } | null;
}

// En memoire : un redemarrage perd les rendus en cours. Acceptable pour le MVP,
// et deja le cas du store de generation existant.
const jobs = new Map<string, Entree>();

export function createRenderJob(userId: string): RenderJob {
  // randomUUID et non un compteur : l'id voyage dans une URL de telechargement,
  // il ne doit pas etre devinable.
  const job: RenderJob = {
    id: randomUUID(),
    userId,
    status: "pending",
    progress: 0,
    outputPath: null,
    error: null,
    createdAt: new Date(),
  };
  jobs.set(job.id, { job, child: null });
  return job;
}

export function getRenderJob(id: string, userId: string): RenderJob | undefined {
  const e = jobs.get(id);
  // Le job d'un autre est traite comme inexistant : distinguer les deux
  // confirmerait son existence.
  return e && e.job.userId === userId ? e.job : undefined;
}

export function attachChild(id: string, child: { kill: () => void }): void {
  const e = jobs.get(id);
  if (e) e.child = child;
}

export function updateRenderJob(id: string, patch: Partial<RenderJob>): void {
  const e = jobs.get(id);
  if (e) Object.assign(e.job, patch);
}

export function cancelRenderJob(id: string, userId: string): boolean {
  const e = jobs.get(id);
  if (!e || e.job.userId !== userId) return false;
  e.child?.kill();
  e.job.status = "cancelled";
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/server/render-store.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/server/render-store.ts lib/whiteboard-animation/server/render-store.test.ts
git commit -m "feat(export): job store des rendus, cloisonne par utilisateur"
```

---

### Task 7: Adaptateur storyboard → projet

**Files:**
- Create: `lib/whiteboard-animation/server/to-render-project.ts`
- Test: `lib/whiteboard-animation/server/to-render-project.test.ts`

**Interfaces:**
- Consumes: `toEngineAnnotations` de `@/lib/whiteboard-animation/timeline/annotation-interop`.
- Produces: `toRenderProject(input: { panels: StoryboardPanel[]; config: WhiteboardConfig }): RenderProject` où `RenderProject = { animStyle, hand, handSpeed, tileSlider, speed, narration, scenes: RenderScene[] }` et `RenderScene = { id, canvasImage, annotations, transition }`.

Tourne **dans la route**, pas dans le worker. Fonction pure.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { toRenderProject } from "./to-render-project";

const config: any = {
  animStyle: "contour",
  handStyle: "custom1",
  canvasBg: "white",
  annotations: [],
  annotationConfig: {},
  audio: { url: "blob:x", persistUrl: "data:audio/mp3;base64,AAA", volume: 1, muted: false, durationMs: 5000 },
  transcript: [],
};

const panel = (id: string, from: number, to: number): any => ({
  id,
  imageUrl: `/img/${id}.png`,
  annotations: [{ id: `${id}-a`, region: { x: 0, y: 0, width: 10, height: 10 }, reveal: { from, to, durationMs: to - from } }],
});

describe("toRenderProject", () => {
  it("fait une scene par panneau, dans l'ordre", () => {
    const p = toRenderProject({ panels: [panel("p1", 0, 400), panel("p2", 400, 900)], config });
    expect(p.scenes.map((s) => s.id)).toEqual(["p1", "p2"]);
    expect(p.scenes[0].canvasImage).toBe("/img/p1.png");
  });

  it("reprend le style, la main et la cadence depuis la config", () => {
    const p = toRenderProject({ panels: [panel("p1", 0, 400)], config });
    expect(p).toMatchObject({ animStyle: "contour", hand: "custom1", speed: 40 });
  });

  it("prend l'audio persistable et non l'URL blob, illisible hors de l'onglet", () => {
    const p = toRenderProject({ panels: [panel("p1", 0, 400)], config });
    expect(p.narration?.audioUrl).toBe("data:audio/mp3;base64,AAA");
  });

  it("accepte l'absence d'audio", () => {
    const p = toRenderProject({ panels: [panel("p1", 0, 400)], config: { ...config, audio: null } });
    expect(p.narration).toBeNull();
  });

  it("retombe sur les annotations globales si un panneau n'en a pas", () => {
    const sans: any = { id: "p1", imageUrl: "/img/p1.png", annotations: [] };
    const cfg = { ...config, annotations: [{ id: "g", region: { x: 0, y: 0, width: 5, height: 5 }, reveal: { from: 0, to: 100, durationMs: 100 } }] };
    const p = toRenderProject({ panels: [sans], config: cfg });
    expect(p.scenes[0].annotations).toHaveLength(1);
  });

  it("rend un projet sans scene si aucun panneau", () => {
    expect(toRenderProject({ panels: [], config }).scenes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/server/to-render-project.test.ts`
Expected: FAIL — module introuvable

- [ ] **Step 3: Write minimal implementation**

```ts
import { toEngineAnnotations } from "@/lib/whiteboard-animation/timeline/annotation-interop";
import type { WhiteboardConfig } from "@/lib/storyboard/store";
import type { StoryboardPanel } from "@/lib/storyboard/schema";

export interface RenderScene {
  id: string;
  canvasImage: string;
  annotations: unknown[];
  transition: { transitionAfter: string | null } | null;
}

export interface RenderProject {
  animStyle: string;
  hand: string;
  handSpeed: number;
  tileSlider: number;
  speed: number;
  narration: { audioUrl: string } | null;
  scenes: RenderScene[];
}

/** Animation.DEFAULT_SPEED : toute autre valeur ferait deriver le dessin
 *  par rapport a la narration, dont reveal.from/to sont les timestamps. */
const FIDELE_1X = 40;

export function toRenderProject({
  panels,
  config,
}: {
  panels: StoryboardPanel[];
  config: WhiteboardConfig;
}): RenderProject {
  // persistUrl et non url : `url` est une blob: URL, qui n'existe que dans
  // l'onglet qui l'a creee. Envoyee au rendu, ffmpeg ne peut pas la lire.
  const audioUrl = config.audio?.persistUrl ?? config.audio?.url ?? null;

  return {
    animStyle: config.animStyle,
    hand: config.handStyle,
    handSpeed: config.handSpeed ?? 5,
    tileSlider: config.chunks ?? 30,
    speed: FIDELE_1X,
    narration: audioUrl ? { audioUrl } : null,
    scenes: panels.map((panel: any) => ({
      id: panel.id,
      canvasImage: panel.imageUrl,
      annotations: toEngineAnnotations(
        panel.annotations?.length ? panel.annotations : config.annotations || [],
      ),
      transition: null,
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/server/to-render-project.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/server/to-render-project.ts lib/whiteboard-animation/server/to-render-project.test.ts
git commit -m "feat(export): adaptateur storyboard vers projet de rendu"
```

---

### Task 8: Les routes

**Files:**
- Create: `app/api/whiteboard/render/route.ts`
- Create: `app/api/whiteboard/render/[jobId]/route.ts`
- Create: `app/api/whiteboard/render/[jobId]/file/route.ts`

**Interfaces:**
- Consumes: `renderRequestSchema`, `resolveExportSize` (Task 1) ; `createRenderJob`, `getRenderJob`, `attachChild`, `updateRenderJob`, `cancelRenderJob` (Task 6) ; `render-worker.js` (Task 5).
- Produces: `POST /api/whiteboard/render` → `202 { jobId }` ; `GET .../[jobId]` → `{ jobId, status, progress, error }` ; `DELETE .../[jobId]` → `{ cancelled: true }` ; `GET .../[jobId]/file` → le mp4.

Le patron d'authentification du dépôt est `auth.api.getSession({ headers: await headers() })` (voir `app/api/user/profile/route.ts`).

- [ ] **Step 1: Écrire la route POST**

```ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { fork } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { renderRequestSchema, resolveExportSize } from "@/lib/whiteboard-animation/server/render-request";
import { attachChild, createRenderJob, updateRenderJob } from "@/lib/whiteboard-animation/server/render-store";

// Hors de public/ : Next y sert tout fichier sans aucun controle, donc la video
// d'un utilisateur serait telechargeable par quiconque devine l'URL.
const OUTPUT_DIR = process.env.RENDER_OUTPUT_DIR || join(process.cwd(), ".renders");

// fork() exige un chemin reel a l'execution : le worker est un .js resolu
// depuis la racine, pas un module du bundle.
const WORKER = join(process.cwd(), "lib/whiteboard-animation/server/render-worker.js");

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide" }, { status: 400 });
  }

  const parsed = renderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { width, height } = resolveExportSize(parsed.data.quality, parsed.data.aspectRatio);
  const job = createRenderJob(session.user.id);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = join(OUTPUT_DIR, `${job.id}.mp4`);

  const child = fork(WORKER, { stdio: "pipe" });
  attachChild(job.id, child);
  updateRenderJob(job.id, { status: "rendering" });

  child.on("message", (m: any) => {
    if (m?.type === "progress") updateRenderJob(job.id, { progress: m.value });
    if (m?.type === "done") updateRenderJob(job.id, { status: "done", progress: 100, outputPath });
    if (m?.type === "error") updateRenderJob(job.id, { status: "error", error: m.message });
  });
  child.on("exit", (code) => {
    // Sortie non nulle sans message d'erreur : tue, ou plante sans avoir pu
    // rendre compte. Sans ce filet le job resterait "rendering" pour toujours.
    if (code !== 0) {
      updateRenderJob(job.id, { status: "error", error: `Worker sorti avec le code ${code}` });
    }
  });

  child.send({ project: parsed.data.project, width, height, fps: 30, outputPath });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
```

- [ ] **Step 2: Écrire la route GET/DELETE**

```ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { cancelRenderJob, getRenderJob } from "@/lib/whiteboard-animation/server/render-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const job = getRenderJob(jobId, session.user.id);
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  if (!cancelRenderJob(jobId, session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ cancelled: true });
}
```

- [ ] **Step 3: Écrire la route de téléchargement**

```ts
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
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const job = getRenderJob(jobId, session.user.id);
  if (!job || job.status !== "done" || !job.outputPath || !existsSync(job.outputPath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(job.outputPath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(statSync(job.outputPath).size),
      "Content-Disposition": `attachment; filename="whiteboard-${jobId}.mp4"`,
    },
  });
}
```

- [ ] **Step 4: Vérifier à la main**

Le serveur de développement doit tourner et une session être ouverte.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/whiteboard/render \
  -H 'content-type: application/json' -d '{}'
```
Expected: `401` sans cookie de session — la route est bien fermée.

- [ ] **Step 5: Vérifier que le build passe et committer**

Run: `npx tsc --noEmit && npx next build`

```bash
git add app/api/whiteboard
git commit -m "feat(export): routes de rendu, statut, annulation et telechargement"
```

---

### Task 9: Brancher l'ExportModal

**Files:**
- Modify: `app/(protected)/storyboard/page.tsx:1941-1962`

**Interfaces:**
- Consumes: `toRenderProject` (Task 7) et les routes (Task 8).

Remplacer le `setTimeout` par un vrai appel, avec interrogation du statut et annulation.

- [ ] **Step 1: Remplacer le corps de `onStartExport`**

```tsx
onStartExport={async (resolution) => {
  setExportPhase("init");
  setIsExporting(true);
  setDownloadUrl(null);
  try {
    const project = toRenderProject({
      panels: storyboardPanels,
      config: whiteboardConfig,
    });
    const res = await fetch("/api/whiteboard/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quality: resolution,
        aspectRatio: projectParams.aspectRatio,
        project,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Export refuse");
    const { jobId } = await res.json();
    renderJobIdRef.current = jobId;
    setExportPhase("encoding");

    // Interrogation plutot que websocket : un rendu dure des minutes, et une
    // seconde de latence sur une barre de progression ne se voit pas.
    while (true) {
      await new Promise((r) => setTimeout(r, 1000));
      const s = await fetch(`/api/whiteboard/render/${jobId}`).then((r) => r.json());
      setExportProgress(s.progress ?? 0);
      if (s.status === "done") {
        setDownloadUrl(`/api/whiteboard/render/${jobId}/file`);
        setExportPhase("complete");
        break;
      }
      if (s.status === "error") throw new Error(s.error || "Le rendu a echoue");
      if (s.status === "cancelled") { setExportPhase("idle"); break; }
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Export echoue");
    setExportPhase("idle");
  } finally {
    setIsExporting(false);
  }
}}
onCancel={() => {
  const id = renderJobIdRef.current;
  if (id) void fetch(`/api/whiteboard/render/${id}`, { method: "DELETE" });
  setIsExporting(false);
  setExportPhase("idle");
  setDownloadUrl(null);
}}
```

- [ ] **Step 2: Déclarer la référence du job**

Près des autres `useRef` du composant :

```tsx
const renderJobIdRef = useRef<string | null>(null);
```

Et importer l'adaptateur :

```tsx
import { toRenderProject } from "@/lib/whiteboard-animation/server/to-render-project";
```

- [ ] **Step 3: Vérifier qu'il ne reste rien du faux export**

```bash
grep -n "TODO: Implement actual export logic" "app/(protected)/storyboard/page.tsx"
```
Expected: aucun résultat.

- [ ] **Step 4: Vérifier types, tests et build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: 0 erreur, tous les tests verts, build terminé.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/storyboard/page.tsx"
git commit -m "feat(export): brancher la modale d'export sur le rendu serveur"
```

---

### Task 10: Vérification en conditions réelles

**Files:**
- Modify: `.gitignore`
- Modify: `docs/superpowers/specs/2026-09-04-whiteboard-export-serveur-design.md`

Le spec le dit : `fork()` depuis une route Next est **le point le plus susceptible de ne marcher qu'en développement**. Cette tâche existe pour le prouver ou l'infirmer.

- [ ] **Step 1: Ignorer le dossier de sortie**

Ajouter à `.gitignore` :

```
.renders/
```

- [ ] **Step 2: Rendre une vraie vidéo en développement**

Ouvrir `/storyboard`, lancer un export en 720p, attendre la fin, télécharger.

```bash
ffprobe -v error -show_entries format=duration,format_name -of default=nw=1 ~/Téléchargements/whiteboard-*.mp4
```
Expected: `format_name=mov,mp4,...` et une durée proche de celle de la timeline.

- [ ] **Step 3: Refaire la même chose sur un build de production**

```bash
npx next build && npx next start
```
Puis relancer un export. Expected: le worker se lance et la vidéo sort. Si `fork()` échoue à trouver le worker, corriger la résolution du chemin et **noter la correction dans le spec**.

- [ ] **Step 4: Vérifier que l'annulation interrompt vraiment**

Lancer un export, cliquer sur Annuler, puis :

```bash
pgrep -fa render-worker.js
```
Expected: aucun process. Le job passe à `cancelled`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore docs/superpowers/specs/2026-09-04-whiteboard-export-serveur-design.md
git commit -m "chore(export): ignorer .renders et consigner la verification en production"
```
