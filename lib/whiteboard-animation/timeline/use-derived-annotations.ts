"use client";

import { useEffect, useMemo } from "react";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { deriveTimeline } from "./derive-timeline";

export interface UseDerivedAnnotationsOptions {
  /**
   * Whether the annotation schedule sets the timeline duration. False when a
   * narration track owns it: the video lasts as long as its audio, and the
   * schedule is only the drawing plan. Both writing unconditionally would let
   * them fight over the store.
   */
  governsDuration?: boolean;
}

/**
 * The render path's single entry point to annotation timing.
 *
 * Whoever writes to the store only sets order, durations and gaps; the absolute
 * positions are recomputed here, so the renderer can never read a stale or
 * hand-edited startMs.
 */
export function useDerivedAnnotations(
  { governsDuration = true }: UseDerivedAnnotationsOptions = {}
) {
  const annotations = useUnifiedEngineStore((s) => s.animation.annotations);
  const storeDuration = useUnifiedEngineStore((s) => s.timeline.duration);
  const setDuration = useUnifiedEngineStore((s) => s.setDuration);

  const derived = useMemo(() => deriveTimeline(annotations), [annotations]);

  useEffect(() => {
    if (!governsDuration) return;
    if (annotations.length === 0) return;
    if (derived.totalDurationMs === storeDuration) return;
    setDuration(derived.totalDurationMs);
  }, [
    governsDuration,
    annotations.length,
    derived.totalDurationMs,
    storeDuration,
    setDuration,
  ]);

  return derived;
}
