export interface AudioTrack {
  id: string;
  /** Playable now: blob: (upload), data:, or https: (generated TTS). */
  url: string;
  /**
   * The form that survives a reload — data: for an upload, https: for TTS.
   *
   * `url` is rehydrated into a fresh blob: so media elements get a short src,
   * and a blob: is dead in the next session. Without keeping the durable
   * original the save/load round trip wrote that runtime blob: back to
   * storage, and the track was unrecoverable from then on.
   */
  persistUrl?: string;
  source: 'upload' | 'tts';
  /** Display name for the track lane — the original filename for an upload. */
  name: string;
  volume: number; // 0..1
  muted: boolean;
  offsetMs: number; // shifts narration start relative to timeline 0
  durationMs: number;
}

export interface TranscriptCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  annotationId?: string; // set once manually linked to an annotation
}
