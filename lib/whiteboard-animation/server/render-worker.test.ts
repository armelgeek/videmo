import { fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "wb-worker-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const WORKER = join(process.cwd(), "lib/whiteboard-animation/server/render-worker.js");

function run(message: Record<string, unknown>): Promise<any[]> {
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
  it("livre 'done' AVANT de sortir, sans le perdre", async () => {
    // process.send est asynchrone : un process.exit() immediat coupe avant que
    // le message parte. La route ne voyait alors qu'une sortie en code 0 sans
    // 'done', et le job restait fige sur sa derniere progression — observe en
    // production, bloque a 88 % alors que la video etait complete.
    const recus = await run({
      project: {
        animStyle: "chunkjump", hand: "custom1", handSpeed: 5,
        speed: 40, tileSlider: 30,
        scenes: [{
          id: "s1",
          canvasImage: join(process.cwd(), "public", "images", "hand1-720p.png"),
          annotations: [{
            region: { x: 0, y: 0, width: 60, height: 40 },
            reveal: { from: 0, to: 200, startMs: 0, durationMs: 200 },
          }],
        }],
      },
      width: 96, height: 64, fps: 10,
      outputPath: join(dir, "ok.mp4"),
    });
    expect(recus.at(-1)).toMatchObject({ type: "done" });
  }, 120_000);

  it("signale l'erreur et sort en echec sur un projet vide", async () => {
    const recus = await run({
      project: { scenes: [] },
      width: 128, height: 96, fps: 10,
      outputPath: join(dir, "vide.mp4"),
    });
    expect(recus.at(-1)).toMatchObject({ type: "error" });
  }, 60_000);
});
