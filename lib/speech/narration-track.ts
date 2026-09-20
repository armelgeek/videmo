import type { StoryboardPanel } from "@/lib/storyboard/schema";

export interface NarrationPart {
  url: string;
  durationMs: number;
}

/**
 * The project's recordings, in film order.
 *
 * Usually just one: the whole script is read in one take, and the beats are
 * located in it through the transcription. Several images therefore share the
 * same voice, and it is the URL change — forced by the engine's character
 * cap — that separates two recordings.
 *
 * Each one's duration is the end of the last beat it carries: only the beats
 * know where they stop inside it.
 */
export function narrationParts(panels: StoryboardPanel[]): NarrationPart[] {
  const parts: NarrationPart[] = [];
  let current: NarrationPart | null = null;

  for (const panel of panels) {
    const spoken = (panel.beats ?? []).filter((beat) => beat.audioUrl);

    if (spoken.length === 0) {
      // An image without beats keeps its own voice: nothing in it points to a
      // timestamp, so it shares nothing.
      if (!panel.audioUrl) continue;
      current = {
        url: panel.audioUrl,
        durationMs:
          panel.audioDurationMs && panel.audioDurationMs > 0
            ? panel.audioDurationMs
            : Math.round((panel.duration || 5) * 1000),
      };
      parts.push(current);
      current = null;
      continue;
    }

    for (const beat of spoken) {
      const end = (beat.startMs ?? 0) + (beat.audioDurationMs ?? 0);
      if (current && current.url === beat.audioUrl) {
        current.durationMs = Math.max(current.durationMs, end);
        continue;
      }
      current = { url: beat.audioUrl as string, durationMs: end };
      parts.push(current);
    }
  }

  return parts;
}

/** The whole narration's duration: the sum of its recordings. */
export function narrationDurationMs(parts: NarrationPart[]): number {
  return parts.reduce((total, part) => total + part.durationMs, 0);
}
