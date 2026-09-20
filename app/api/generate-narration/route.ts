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
import { alignBeats, type TranscriptWord } from "@/lib/speech/beat-alignment";
import { billingErrorResponse, chargeFor } from "@/lib/billing/with-credits";
import { assertStorageAvailable, recordStoredObject } from "@/lib/billing/org-usage";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";
import { aiGenerationRateLimit, tooManyGenerations } from "@/lib/security/rate-limiter";

// About three seconds per scene, plus uploading to the bucket.
export const maxDuration = 120;

const requestSchema = z.object({
  projectId: z.string().min(1),
  sceneIndex: z.number().int().nonnegative(),
  beatIndex: z.number().int().nonnegative().optional(),
  // 4096 is the engine's limit: rejecting below it deprived an image of its
  // voice even though the caller had already split it under that budget.
  text: z.string().min(1).max(4096),
  voice: z.string().default("nova"),
  /**
   * The narration beats this text contains, in order.
   *
   * When provided, the recording is transcribed and each beat is FOUND in it.
   * This replaces beat-by-beat synthesis: we record in one take (so with the
   * linking and momentum of a real reading) and measure afterwards, instead of
   * splitting in order to measure.
   */
  beats: z.array(z.object({ narration: z.string() })).optional(),
  language: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const limit = await aiGenerationRateLimit(viewer.userId, "narration");
    if (!limit.success) return tooManyGenerations(limit.resetAt);
    const input = requestSchema.parse(await request.json());

    // Synthesizing costs money: the right to write to THIS project is checked
    // before calling the engine, not after.
    await requireProjectAccess(input.projectId, viewer, "update");

    // Engine and bucket resolved first: an incomplete configuration must show
    // up before paying for audio we would have nowhere to write.
    const speech = getSpeechGenerator();
    const storage = getObjectStorage();

    if (viewer.organizationId) await assertStorageAvailable(viewer.organizationId);

    return await chargeFor(
      viewer,
      "generate_narration",
      async () => {
        const audio = await speech.speak({ text: input.text, voice: input.voice });

        // Measured on the file, never estimated: annotations align to it, and any
        // drift would accumulate from one narration beat to the next.
        let durationMs: number | null = null;
        try {
          durationMs = await measureAudioDurationMs(audio);
        } catch (cause) {
          // A failed measurement must not deprive the scene of its voice: alignment
          // falls back to the split's estimate.
          console.error("Could not measure narration duration:", cause);
        }

        // Beats are found in the recording, never split beforehand. A failure
        // does not deprive the scene of its voice: alignment falls back to the
        // split's estimate.
        let beats: Awaited<ReturnType<typeof alignBeats>> | null = null;
        // The transcription is used to realign, but it carries the timing of EVERY word.
        // Throwing it away meant paying again to transcribe the same recording as soon
        // as we want something else from it (subtitles, for example). So it is
        // returned with the rest.
        let words: TranscriptWord[] = [];
        if (input.beats?.length && durationMs) {
          try {
            words = await getTranscriber().transcribe({
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

        const key = buildNarrationKey({
          projectId: input.projectId,
          sceneIndex: input.sceneIndex,
          beatIndex: input.beatIndex,
        });
        const url = await storage.put({
          key,
          body: audio,
          contentType: "audio/mpeg",
        });
        if (viewer.organizationId) {
          await recordStoredObject({
            organizationId: viewer.organizationId,
            projectId: input.projectId,
            key,
            bytes: audio.byteLength,
          });
        }

        return NextResponse.json({ url, durationMs, beats, words });
      },
      { referenceId: input.projectId },
    );
  } catch (error) {
    const billing = billingErrorResponse(error);
    if (billing) return billing;
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
