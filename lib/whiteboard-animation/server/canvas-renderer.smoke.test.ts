import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderProjectToVideo } = require("./canvas-renderer");

const dir = mkdtempSync(join(tmpdir(), "wb-render-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Une scene minuscule : le but est de prouver que la chaine complete produit one
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
  it("produit one mp4 lisible avec le bon nombre d'images", async () => {
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

  /**
   * La voix est produite par temps : chacun reste une entree, retardee de son
   * start absolu. Ce test verifie que le son SORT, et qu'il commence bien la
   * ou le second morceau est place — pas au start de la video.
   */
  it("muxe plusieurs temps de narration, chacun a sa place", async () => {
    const one = join(dir, "one.mp3");
    const two = join(dir, "two.mp3");
    for (const [file, freq] of [[one, 440], [two, 880]] as [string, number][]) {
      execFileSync("ffmpeg", [
        "-v", "error", "-f", "lavfi",
        "-i", `sine=frequency=${freq}:sample_rate=24000`,
        "-t", "0.5", "-c:a", "libmp3lame", "-y", file,
      ]);
    }

    const out = join(dir, "voix.mp4");
    await renderProjectToVideo(
      {
        ...project,
        // Le second temps commence a two secondes : entre les two, le
        // silence doit rester du silence.
        // La scene doit durer plus que le second temps : `-shortest` couperait
        // sinon la video avant qu'il ne se fasse entendre.
        scenes: [
          {
            id: "s1",
            canvasImage: join(process.cwd(), "public", "images", "hand1-720p.png"),
            annotations: [
              { region: { x: 0, y: 0, width: 60, height: 40 }, reveal: { from: 0, to: 3000 } },
            ],
          },
        ],
        narration: {
          parts: [
            { url: one, startMs: 0, durationMs: 500 },
            { url: two, startMs: 2000, durationMs: 500 },
          ],
        },
      },
      out,
      { width: 128, height: 96, fps: 10 },
    );

    const stream = execFileSync("ffprobe", [
      "-v", "error", "-select_streams", "a:0",
      "-show_entries", "stream=codec_name", "-of", "csv=p=0", out,
    ]).toString().trim();
    expect(stream).toBe("aac");

    // Le level sur la seconde qui precede le second temps, puis sur celle qui
    // le contient : le premier doit etre silencieux, le second non.
    // volumedetect ecrit son rapport sur la sortie d'ERREUR, pas sur stdout.
    const level = (start: string) => {
      const { stderr } = spawnSync("ffmpeg", [
        "-v", "info", "-ss", start, "-t", "0.4", "-i", out,
        "-af", "volumedetect", "-f", "null", "-",
      ]);
      const match = stderr.toString().match(/max_volume:\s*(-?\d+(?:\.\d+)?)/);
      return match ? Number(match[1]) : Number.NaN;
    };

    expect(level("1.2")).toBeLessThan(-60);
    expect(level("2.05")).toBeGreaterThan(-30);
  }, 180_000);
});
