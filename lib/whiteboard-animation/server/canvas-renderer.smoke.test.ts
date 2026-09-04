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
