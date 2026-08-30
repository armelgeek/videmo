"use client";

import { useMemo } from "react";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { deriveTimeline } from "./derive-timeline";

/**
 * The render path's single entry point to annotation timing.
 *
 * Whoever writes to the store only sets order, durations and gaps; the absolute
 * positions are recomputed here, so the renderer can never read a stale or
 * hand-edited startMs.
 */
export function useDerivedAnnotations() {
  const annotations = useUnifiedEngineStore((s) => s.animation.annotations);
  return useMemo(() => deriveTimeline(annotations), [annotations]);
}
