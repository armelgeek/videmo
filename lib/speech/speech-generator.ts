/**
 * Le contrat de synthese vocale.
 *
 * Meme forme qu'ObjectStorage et ImageGenerator : la route ignore quel moteur
 * parle, les tests passent un double, et changer de fournisseur ne touche qu'un
 * adaptateur.
 */
export interface SpeechGenerator {
  speak(input: SpeakInput): Promise<Uint8Array>;
}

export interface SpeakInput {
  text: string;
  /** Un identifiant du catalogue ci-dessous, jamais une valeur libre. */
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
 * Les voix reellement disponibles.
 *
 * Elles sont multilingues : la meme voix lit le francais et l'anglais. L'ecran
 * les rangeait auparavant par langue, avec des personas inventes — un choix
 * fait sur une fiction, et deux personas differents pouvaient rendre le meme
 * son. Aucune description de timbre ici : l'apercu audio est la source de
 * verite, et decrire une voix qu'on n'a pas ecoutee recreerait la fiction.
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

/** Ramene un choix enregistre vers une voix qui existe encore. */
export function normalizeVoice(voice: unknown): VoiceId {
  return VOICES.includes(voice as VoiceId) ? (voice as VoiceId) : DEFAULT_VOICE;
}

/**
 * Le plus petit MP3 valide : une trame silencieuse. Les tests ont besoin
 * d'octets qu'un lecteur accepte, pas d'une vraie narration.
 */
export const SILENT_MP3 = Uint8Array.from([
  0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00,
]);

/** Double de test : rend un MP3 valide sans reseau et retient les demandes. */
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
