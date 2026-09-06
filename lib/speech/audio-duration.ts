import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * La duree reelle d'un audio, en millisecondes.
 *
 * Le decoupage estime la duree de chaque temps de narration a trois mots par
 * seconde. C'est bon pour repartir le texte, mais faux au dixieme de seconde :
 * caler les annotations dessus faisait deriver le trace par rapport a la voix,
 * et l'ecart s'accumulait d'un temps au suivant. Seul le fichier produit dit la
 * verite.
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
