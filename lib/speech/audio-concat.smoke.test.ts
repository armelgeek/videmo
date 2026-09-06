import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { concatNarration } from "./audio-concat";

/** La duree reelle du resultat, lue par ffprobe. */
function dureeMs(audio: Uint8Array): number {
  const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
  const { tmpdir } = require("node:os");
  const { join } = require("node:path");
  const dir = mkdtempSync(join(tmpdir(), "concat-verif-"));
  const file = join(dir, "a.mp3");
  try {
    writeFileSync(file, audio);
    const out = execFileSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ]).toString();
    return Math.round(Number.parseFloat(out.trim()) * 1000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Un vrai mp3 d'une duree donnee, fabrique par ffmpeg. */
function ton(durationMs: number): Uint8Array {
  const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
  const { tmpdir } = require("node:os");
  const { join } = require("node:path");
  const dir = mkdtempSync(join(tmpdir(), "concat-ton-"));
  const file = join(dir, "t.mp3");
  try {
    execFileSync("ffmpeg", [
      "-v", "error",
      "-f", "lavfi",
      "-i", "sine=frequency=440:sample_rate=24000",
      "-t", (durationMs / 1000).toFixed(3),
      "-c:a", "libmp3lame", "-b:a", "128k",
      "-y", file,
    ]);
    return new Uint8Array(readFileSync(file));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("concatNarration (lent : lance ffmpeg)", () => {
  it("rend une piste de la duree des morceaux mis bout a bout", async () => {
    const piste = await concatNarration([
      { audio: ton(1000), durationMs: 1000 },
      { audio: ton(2000), durationMs: 2000 },
    ]);

    // L'encodage mp3 ajoute quelques dizaines de millisecondes de trame.
    expect(dureeMs(piste)).toBeGreaterThan(2900);
    expect(dureeMs(piste)).toBeLessThan(3200);
  });

  it("remplace un temps muet par un silence de sa duree", async () => {
    const piste = await concatNarration([
      { audio: null, durationMs: 1500 },
      { audio: ton(1000), durationMs: 1000 },
    ]);

    expect(dureeMs(piste)).toBeGreaterThan(2400);
    expect(dureeMs(piste)).toBeLessThan(2700);
  });

  it("refuse une piste sans aucun morceau", async () => {
    await expect(concatNarration([])).rejects.toThrow();
  });
});
