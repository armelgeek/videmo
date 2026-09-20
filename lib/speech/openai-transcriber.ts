import {
  type TranscribeInput,
  type Transcriber,
  TranscriberNotConfiguredError,
  TranscriptionFailedError,
} from "./transcriber";
import type { TranscriptWord } from "./beat-alignment";

const TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";

export interface OpenAiTranscriberConfig {
  apiKey: string;
  model: string;
}

export function readOpenAiTranscriberConfig(
  env: Record<string, string | undefined> = process.env,
): OpenAiTranscriberConfig {
  if (!env.OPENAI_API_KEY?.trim()) {
    throw new TranscriberNotConfiguredError(["OPENAI_API_KEY"]);
  }
  return {
    apiKey: env.OPENAI_API_KEY,
    // whisper-1 rather than a newer model: it is the only one returning
    // PER-WORD timestamps, and those, not the text, are what we are after.
    model: env.OPENAI_TRANSCRIBE_MODEL?.trim() || "whisper-1",
  };
}

export class OpenAiTranscriber implements Transcriber {
  constructor(
    private readonly config: OpenAiTranscriberConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async transcribe(input: TranscribeInput): Promise<TranscriptWord[]> {
    const form = new FormData();
    form.append("model", this.config.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    if (input.language) form.append("language", input.language);
    form.append(
      "file",
      new Blob([input.audio as unknown as BlobPart], { type: "audio/mpeg" }),
      "narration.mp3",
    );

    const response = await this.fetchImpl(TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new TranscriptionFailedError(
        `Transcription failed: ${detail.slice(0, 300)}`,
        response.status,
      );
    }

    return readWords(await response.json());
  }
}

/**
 * The words and their timestamps, in whole milliseconds.
 *
 * The API returns float seconds; everything else in the pipeline counts in
 * whole milliseconds, and the conversion happens once, here.
 */
export function readWords(body: unknown): TranscriptWord[] {
  const rawWords = (body as { words?: unknown })?.words;
  if (!Array.isArray(rawWords)) {
    throw new TranscriptionFailedError("The model returned no word timings");
  }

  return rawWords
    .map((m) => {
      const word = m as { word?: unknown; start?: unknown; end?: unknown };
      return {
        word: typeof word.word === "string" ? word.word : "",
        startMs: Math.round(Number(word.start) * 1000),
        endMs: Math.round(Number(word.end) * 1000),
      };
    })
    .filter(
      (m) =>
        m.word !== "" &&
        Number.isFinite(m.startMs) &&
        Number.isFinite(m.endMs),
    );
}

let cached: Transcriber | null = null;

export function getTranscriber(): Transcriber {
  if (!cached) cached = new OpenAiTranscriber(readOpenAiTranscriberConfig());
  return cached;
}
