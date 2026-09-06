import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  StorageNotConfiguredError,
  buildNarrationKey,
} from "@/lib/storage/object-storage";
import { getObjectStorage } from "@/lib/storage/s3-storage";
import {
  AudioConcatFailedError,
  concatNarration,
} from "@/lib/speech/audio-concat";
import { measureAudioDurationMs } from "@/lib/speech/audio-duration";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

// Un telechargement par temps, puis un reencodage : plus long qu'une synthese,
// mais sans appel a un moteur.
export const maxDuration = 120;

const requestSchema = z.object({
  projectId: z.string().min(1),
  parts: z
    .array(
      z.object({
        url: z.string().url().nullable(),
        durationMs: z.number().positive(),
      }),
    )
    .min(1),
});

/**
 * Reunit les temps de narration en une seule piste.
 *
 * L'etape whiteboard ne joue qu'une piste, remplie jusqu'ici par un
 * televersement a la main : la voix produite par la chaine ne l'atteignait
 * jamais, et un export sortait muet. Les coller dans l'ordre suffit a les
 * caler, puisque le trace se derive des memes durees.
 */
export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const input = requestSchema.parse(await request.json());
    await requireProjectAccess(input.projectId, viewer, "update");

    const storage = getObjectStorage();

    const pieces = await Promise.all(
      input.parts.map(async (part) => {
        if (!part.url) return { audio: null, durationMs: part.durationMs };

        // Le serveur telecharge, comme pour la vision : un bac local — ou
        // prive — n'est pas joignable depuis ailleurs.
        const response = await fetch(part.url);
        if (!response.ok) {
          throw new AudioConcatFailedError(
            `Could not read a narration part (HTTP ${response.status})`,
          );
        }
        return {
          audio: new Uint8Array(await response.arrayBuffer()),
          durationMs: part.durationMs,
        };
      }),
    );

    const track = await concatNarration(pieces);

    // Mesuree sur la piste produite, jamais deduite de la somme : le
    // reencodage ajoute quelques trames, et l'apercu se fie a cette valeur.
    let durationMs = pieces.reduce((total, p) => total + p.durationMs, 0);
    try {
      durationMs = await measureAudioDurationMs(track);
    } catch (cause) {
      console.error("Could not measure the narration track:", cause);
    }

    const url = await storage.put({
      key: buildNarrationKey({ projectId: input.projectId, sceneIndex: 0 }),
      body: track,
      contentType: "audio/mpeg",
    });

    return NextResponse.json({ url, durationMs });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return NextResponse.json(
        { error: error.message, missing: error.missing },
        { status: 503 },
      );
    }
    if (error instanceof AudioConcatFailedError) {
      console.error("Narration track failed:", error.message);
      return NextResponse.json(
        { error: "Could not assemble the narration track" },
        { status: 502 },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return toErrorResponse(error);
  }
}
