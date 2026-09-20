import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The actual duration of an audio clip, in milliseconds.
 *
 * The split estimates each narration beat's duration at three words per
 * second. Good enough to distribute the text, but wrong to the tenth of a
 * second: syncing annotations on it made the drawing drift from the voice,
 * and the gap accumulated from one beat to the next. Only the produced file
 * tells the truth.
 */
export async function measureAudioDurationMs(
  audio: Uint8Array,
): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), "narration-"));
  const file = join(dir, "audio.mp3");

  try {
    await writeFile(file, audio);
    const { stdout } = await run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ]);

    const seconds = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error(`ffprobe returned an unusable duration: ${stdout.trim()}`);
    }
    return Math.round(seconds * 1000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
