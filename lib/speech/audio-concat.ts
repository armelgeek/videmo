import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export class AudioConcatFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioConcatFailedError";
  }
}

export interface AudioPiece {
  /** Les octets du morceau, ou `null` pour un silence de `durationMs`. */
  audio: Uint8Array | null;
  durationMs: number;
}

/**
 * Met bout a bout les morceaux de narration en une seule piste.
 *
 * L'etape whiteboard ne joue qu'une piste, et le trace se cale sur la somme
 * des durees des temps : coller les fichiers dans cet ordre les fait donc
 * tomber exactement sur leurs annotations, sans calage a ajouter.
 *
 * Un temps sans voix devient un silence de sa duree, sans quoi tout ce qui
 * suit avancerait d'autant.
 *
 * Le flux est reencode plutot que copie : les morceaux viennent du meme moteur,
 * mais un silence fabrique ici ne partage pas leurs parametres, et le demuxer
 * `concat` refuse de copier des flux qui different.
 */
export async function concatNarration(
  pieces: AudioPiece[],
): Promise<Uint8Array> {
  if (pieces.length === 0) {
    throw new AudioConcatFailedError("Nothing to concatenate");
  }

  const dir = await mkdtemp(join(tmpdir(), "narration-track-"));

  try {
    const files: string[] = [];

    for (const [index, piece] of pieces.entries()) {
      const file = join(dir, `${index}.mp3`);
      if (piece.audio) {
        await writeFile(file, piece.audio);
      } else {
        await silence(file, piece.durationMs);
      }
      files.push(file);
    }

    // Une liste sur disque, et non des entrees repetees sur la ligne de
    // commande : le nombre de temps n'est pas borne.
    const liste = join(dir, "liste.txt");
    await writeFile(
      liste,
      files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"),
    );

    const sortie = join(dir, "piste.mp3");
    await run("ffmpeg", [
      "-v", "error",
      "-f", "concat",
      "-safe", "0",
      "-i", liste,
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      "-y", sortie,
    ]);

    return new Uint8Array(await readFile(sortie));
  } catch (cause) {
    throw new AudioConcatFailedError(
      cause instanceof Error ? cause.message : "ffmpeg failed",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function silence(file: string, durationMs: number): Promise<unknown> {
  return run("ffmpeg", [
    "-v", "error",
    "-f", "lavfi",
    "-i", "anullsrc=r=24000:cl=mono",
    "-t", (Math.max(1, durationMs) / 1000).toFixed(3),
    "-c:a", "libmp3lame",
    "-b:a", "128k",
    "-y", file,
  ]);
}
