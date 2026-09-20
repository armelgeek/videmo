import { DRIFT_MAX_MS } from "../hooks/audio-delta";

/**
 * A narration beat placed on the project clock.
 *
 * `startMs` is absolute, not an offset from the previous beat: a silent beat
 * then leaves a gap without anyone having to fabricate silence.
 */
export interface NarrationPart {
  url: string;
  startMs: number;
  durationMs: number;
}

/**
 * A STABLE empty array, to use as a default.
 *
 * A `[]` written in a signature is a new array on every render: the
 * dependency keeps changing and the clock would rebuild endlessly.
 */
export const AUCUNE_PART: readonly NarrationPart[] = Object.freeze([]);

export interface PartAtPosition {
  /** The part's rank in the list: it identifies the source to load. */
  index: number;
  part: NarrationPart;
  /** Where we are WITHIN this part, in milliseconds. */
  offsetMs: number;
}

/**
 * Which part should be heard at this instant, and at what position.
 *
 * Returns `null` in gaps — before the first beat, between two, after the
 * last — where nothing should play. The caller then mutes the sound without
 * stopping the drawing: the wall clock owns the timeline, audio follows it.
 *
 * Parts are assumed ordered and non-overlapping, which they are by
 * construction: they derive from the same durations as the annotations.
 */
export function partAt(
  parts: NarrationPart[],
  positionMs: number,
): PartAtPosition | null {
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (positionMs < part.startMs) return null;
    if (positionMs < part.startMs + part.durationMs) {
      return { index, part, offsetMs: positionMs - part.startMs };
    }
  }
  return null;
}

/** The end of the last part: the duration of the whole narration. */
export function narrationEndMs(parts: NarrationPart[]): number {
  return parts.reduce(
    (end, part) => Math.max(end, part.startMs + part.durationMs),
    0,
  );
}

/**
 * Lays parts end to end from their durations alone.
 *
 * It is the same computation `deriveTimeline` does on the annotations: both
 * start from the measured durations, so each part lands on its own. A beat
 * without voice still advances the cursor — otherwise everything after it
 * would speak too early.
 */
export function scheduleParts(
  beats: { url: string | null; durationMs: number }[],
): NarrationPart[] {
  const parts: NarrationPart[] = [];
  let startMs = 0;

  for (const beat of beats) {
    if (beat.url) {
      parts.push({ url: beat.url, startMs, durationMs: beat.durationMs });
    }
    startMs += beat.durationMs;
  }

  return parts;
}

/**
 * What a player must do to be at `positionMs`.
 *
 * The decision is pulled out of the player: jsdom implements neither `play`
 * nor `load`, so testing a player directly would prove nothing. Here the rule
 * is verified on its own, and the player only executes.
 */
export type NarrationAction =
  /** Nothing to do: the right part is already playing at the right position. */
  | { type: "none" }
  /** Load this part and move to it: the beat changed. */
  | { type: "load"; index: number; part: NarrationPart; offsetMs: number }
  /** Same part, but the position drifted: resync without reloading. */
  | { type: "resync"; index: number; offsetMs: number }
  /** A gap, or the end: go silent. */
  | { type: "silence" };

export interface NarrationState {
  /** The loaded part, or `null` if none. */
  index: number | null;
  /** Where this part is, according to the player. */
  offsetMs: number;
}

/**
 * The drift tolerated before resyncing.
 *
 * The same as for a single track, for the same reason: beyond about 125 ms an
 * audio/video offset is noticeable. A second, wider threshold had been set
 * here without justification — measured on a real preview, it let the element
 * lag 160 ms behind the clock, and the end of each recording got clipped at
 * the switch.
 *
 * A resync is audible too: that is why the threshold is not zero.
 */
export const NARRATION_DRIFT_MS = DRIFT_MAX_MS;

export function nextNarrationAction(
  state: NarrationState,
  parts: NarrationPart[],
  positionMs: number,
  driftMs: number = NARRATION_DRIFT_MS,
): NarrationAction {
  const target = partAt(parts, positionMs);

  if (!target) return state.index === null ? { type: "none" } : { type: "silence" };

  if (state.index !== target.index) {
    return {
      type: "load",
      index: target.index,
      part: target.part,
      offsetMs: target.offsetMs,
    };
  }

  return Math.abs(state.offsetMs - target.offsetMs) > driftMs
    ? { type: "resync", index: target.index, offsetMs: target.offsetMs }
    : { type: "none" };
}
