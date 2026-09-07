import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  StorageNotConfiguredError,
  buildNarrationKey,
} from "@/lib/storage/object-storage";
import { getObjectStorage } from "@/lib/storage/s3-storage";
import {
  SpeechGenerationFailedError,
  SpeechGeneratorNotConfiguredError,
} from "@/lib/speech/speech-generator";
import { getSpeechGenerator } from "@/lib/speech/openai-speech-generator";
import { measureAudioDurationMs } from "@/lib/speech/audio-duration";
import { getTranscriber } from "@/lib/speech/openai-transcriber";
import { TranscriptionFailedError } from "@/lib/speech/transcriber";
import { alignBeats } from "@/lib/speech/beat-alignment";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

// Environ trois secondes par scene, plus l'envoi au bac.
export const maxDuration = 120;

const requestSchema = z.object({
  projectId: z.string().min(1),
  sceneIndex: z.number().int().nonnegative(),
  beatIndex: z.number().int().nonnegative().optional(),
  text: z.string().min(1).max(4000),
  voice: z.string().default("nova"),
  /**
   * Les temps de narration que ce texte contient, dans l'ordre.
   *
   * Quand ils sont fournis, l'enregistrement est transcrit et chaque temps est
   * RETROUVE dedans. C'est ce qui remplace la synthese temps par temps : on
   * enregistre d'une traite — donc avec les liaisons et l'elan d'une vraie
   * lecture — et on mesure ensuite, au lieu de decouper pour pouvoir mesurer.
   */
  beats: z.array(z.object({ narration: z.string() })).optional(),
  language: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const input = requestSchema.parse(await request.json());

    // Synthetiser coute de l'argent : le droit d'ecrire sur CE projet est
    // verifie avant d'appeler le moteur, pas apres.
    await requireProjectAccess(input.projectId, viewer, "update");

    // Moteur et bac resolus d'abord : une configuration incomplete doit se
    // voir avant d'avoir paye un audio qu'on n'aurait nulle part ou ecrire.
    const speech = getSpeechGenerator();
    const storage = getObjectStorage();

    const audio = await speech.speak({ text: input.text, voice: input.voice });

    // Mesuree sur le fichier, jamais estimee : les annotations se calent
    // dessus, et un ecart s'accumulerait d'un temps de narration au suivant.
    let durationMs: number | null = null;
    try {
      durationMs = await measureAudioDurationMs(audio);
    } catch (cause) {
      // Une mesure ratee ne doit pas priver la scene de sa voix : le calage
      // retombera sur l'estimation du decoupage.
      console.error("Could not measure narration duration:", cause);
    }

    // Les temps sont retrouves dans l'enregistrement, jamais decoupes avant.
    // Un echec ne prive pas la scene de sa voix : le calage retombe sur
    // l'estimation du decoupage.
    let beats: Awaited<ReturnType<typeof alignBeats>> | null = null;
    if (input.beats?.length && durationMs) {
      try {
        const words = await getTranscriber().transcribe({
          audio,
          language: input.language,
        });
        beats = alignBeats({
          beats: input.beats,
          words,
          audioDurationMs: durationMs,
        });
      } catch (cause) {
        console.error("Could not align the narration beats:", cause);
      }
    }

    const url = await storage.put({
      key: buildNarrationKey({
        projectId: input.projectId,
        sceneIndex: input.sceneIndex,
        beatIndex: input.beatIndex,
      }),
      body: audio,
      contentType: "audio/mpeg",
    });

    return NextResponse.json({ url, durationMs, beats });
  } catch (error) {
    if (
      error instanceof StorageNotConfiguredError ||
      error instanceof SpeechGeneratorNotConfiguredError
    ) {
      return NextResponse.json(
        { error: error.message, missing: error.missing },
        { status: 503 },
      );
    }
    if (error instanceof TranscriptionFailedError) {
      console.error("Transcription failed:", error.status, error.message);
      return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }
    if (error instanceof SpeechGenerationFailedError) {
      console.error("Speech generation failed:", error.status, error.message);
      return NextResponse.json(
        { error: "Speech generation failed" },
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
