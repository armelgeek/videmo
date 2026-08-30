"use client";

import { useEffect, useMemo } from "react";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { deriveTimeline } from "./derive-timeline";

/**
 * The render path's single entry point to annotation timing.
 *
 * Whoever writes to the store only sets order, durations and gaps; the absolute
 * positions are recomputed here, so the renderer can never read a stale or
 * hand-edited startMs. The engine's duration follows the same derivation, so
 * playback stops exactly at the end of the last annotation.
 */
export function useDerivedAnnotations() {
  const annotations = useUnifiedEngineStore((s) => s.animation.annotations);
  const storeDuration = useUnifiedEngineStore((s) => s.timeline.duration);
  const setDuration = useUnifiedEngineStore((s) => s.setDuration);

  const derived = useMemo(() => deriveTimeline(annotations), [annotations]);

  useEffect(() => {
    if (annotations.length === 0) return;
    if (derived.totalDurationMs === storeDuration) return;
    setDuration(derived.totalDurationMs);
  }, [annotations.length, derived.totalDurationMs, storeDuration, setDuration]);

  return derived;
}
