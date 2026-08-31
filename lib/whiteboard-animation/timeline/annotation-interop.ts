import type { Annotation as EngineAnnotation } from '@/lib/unified-engine/types';
import type { Annotation as StoredAnnotation } from '../schema';

/**
 * The seam between the two Annotation shapes.
 *
 * The engine requires `text` and the absolute `reveal` fields; the saved
 * schema makes them optional and requires `style` instead, plus fields the
 * engine never declares (`metadata`, `narration`). They are close enough to
 * look interchangeable and a cast would compile, which is exactly why these
 * conversions are explicit: the absolute positions are DERIVED, so restoring
 * a project must not trust whatever was written into them last session.
 */

const DEFAULT_STYLE = { strokeColor: '#000000', strokeWidth: 2, opacity: 1 };

export function toEngineAnnotations(
  stored: StoredAnnotation[]
): EngineAnnotation[] {
  return stored.map((a) => ({
    ...a,
    text: a.text ?? '',
    reveal: {
      // deriveTimeline recomputes these from order + duration + gap, so the
      // stored values are placeholders rather than input.
      from: 0,
      to: 0,
      startMs: 0,
      durationMs: a.reveal.durationMs,
      gapBeforeMs: a.reveal.gapBeforeMs,
    },
    style: a.style ?? DEFAULT_STYLE,
  }));
}

export function toStoredAnnotations(
  engine: EngineAnnotation[]
): StoredAnnotation[] {
  return engine.map((a) => ({
    ...a,
    text: a.text,
    reveal: {
      durationMs: a.reveal.durationMs,
      gapBeforeMs: a.reveal.gapBeforeMs,
    },
    style: { ...DEFAULT_STYLE, ...(a.style ?? {}) },
  })) as StoredAnnotation[];
}
