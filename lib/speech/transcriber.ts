import type { TranscriptWord } from "./beat-alignment";

/**
 * The transcription contract.
 *
 * Same shape as SpeechGenerator and RegionReader: the route does not know
 * which engine listens, tests pass a double, and switching providers only
 * touches one adapter.
 *
 * What matters here is not the text — we know it, it comes from the script —
 * but the TIMESTAMPS. It is the only way to know when each narration beat is
 * spoken within a continuous recording.
 */
export interface Transcriber {
  transcribe(input: TranscribeInput): Promise<TranscriptWord[]>;
}

export interface TranscribeInput {
  audio: Uint8Array;
  /** ISO code of the spoken language: the engine guesses poorly on a single sentence. */
  language?: string;
}

export class TranscriberNotConfiguredError extends Error {
  constructor(readonly missing: string[]) {
    super(`Transcription is not configured. Missing: ${missing.join(", ")}`);
    this.name = "TranscriberNotConfiguredError";
  }
}

export class TranscriptionFailedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TranscriptionFailedError";
  }
}

/** Test double: returns the words it is given, without network. */
export class FakeTranscriber implements Transcriber {
  readonly calls: TranscribeInput[] = [];

  constructor(private readonly words: TranscriptWord[] = []) {}

  async transcribe(input: TranscribeInput): Promise<TranscriptWord[]> {
    this.calls.push(input);
    return this.words;
  }
}
