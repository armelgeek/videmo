/**
 * The speech synthesis contract.
 *
 * Same shape as ObjectStorage and ImageGenerator: the route does not know which
 * engine speaks, tests pass a double, and switching providers only touches one
 * adapter.
 */
export interface SpeechGenerator {
  speak(input: SpeakInput): Promise<Uint8Array>;
}

export interface SpeakInput {
  text: string;
  /** An id from the catalog below, never a free value. */
  voice: string;
}

export class SpeechGeneratorNotConfiguredError extends Error {
  constructor(readonly missing: string[]) {
    super(`Speech generation is not configured. Missing: ${missing.join(", ")}`);
    this.name = "SpeechGeneratorNotConfiguredError";
  }
}

export class SpeechGenerationFailedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SpeechGenerationFailedError";
  }
}

/**
 * The voices actually available.
 *
 * They are multilingual: the same voice reads French and English. The screen
 * used to group them by language, with invented personas — a choice made on a
 * fiction, and two different personas could produce the same sound. No timbre
 * description here: the audio preview is the source of truth, and describing a
 * voice nobody listened to would recreate the fiction.
 */
export const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

export type VoiceId = (typeof VOICES)[number];

export const DEFAULT_VOICE: VoiceId = "nova";

/** Maps a saved choice to a voice that still exists. */
export function normalizeVoice(voice: unknown): VoiceId {
  return VOICES.includes(voice as VoiceId) ? (voice as VoiceId) : DEFAULT_VOICE;
}

/**
 * The smallest valid MP3: one silent frame. Tests need bytes a player
 * accepts, not a real narration.
 */
export const SILENT_MP3 = Uint8Array.from([
  0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00,
]);

/** Test double: returns a valid MP3 without network and records requests. */
export class FakeSpeechGenerator implements SpeechGenerator {
  readonly calls: SpeakInput[] = [];

  constructor(
    private readonly behavior: { audio?: Uint8Array; failWith?: Error } = {},
  ) {}

  async speak(input: SpeakInput): Promise<Uint8Array> {
    this.calls.push(input);
    if (this.behavior.failWith) throw this.behavior.failWith;
    return this.behavior.audio ?? SILENT_MP3;
  }
}
