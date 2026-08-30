export interface AudioTrack {
  id: string;
  url: string; // blob: (upload) or https: (generated TTS)
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
