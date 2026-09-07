import type { TranscriptWord } from "./beat-alignment";

/**
 * Le contrat de transcription.
 *
 * Meme forme que SpeechGenerator et RegionReader : la route ignore quel moteur
 * ecoute, les tests passent un double, et changer de fournisseur ne touche
 * qu'un adaptateur.
 *
 * Ce qui compte ici n'est pas le texte — on le connait, il vient du script —
 * mais les INSTANTS. C'est la seule facon de savoir quand chaque temps de
 * narration est dit dans un enregistrement continu.
 */
export interface Transcriber {
  transcribe(input: TranscribeInput): Promise<TranscriptWord[]>;
}

export interface TranscribeInput {
  audio: Uint8Array;
  /** Code ISO de la langue parlee : le moteur devine mal sur une phrase seule. */
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

/** Double de test : rend les mots qu'on lui donne, sans reseau. */
export class FakeTranscriber implements Transcriber {
  readonly calls: TranscribeInput[] = [];

  constructor(private readonly words: TranscriptWord[] = []) {}

  async transcribe(input: TranscribeInput): Promise<TranscriptWord[]> {
    this.calls.push(input);
    return this.words;
  }
}
