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
  it("signale l'erreur et sort en echec sur un projet vide", async () => {
    const recus = await run({
      project: { scenes: [] },
      width: 128, height: 96, fps: 10,
      outputPath: join(dir, "vide.mp4"),
    });
    expect(recus.at(-1)).toMatchObject({ type: "error" });
  }, 60_000);
});
