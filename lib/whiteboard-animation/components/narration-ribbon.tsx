"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useStoryboardStore } from "@/lib/storyboard/store";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { ANNOTATION_PALETTE } from "../schema";

interface Segment {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * The active scene's narration as one slim line, one segment per beat. Each
 * segment carries the colour of the annotation at the same rank, so what is
 * said reads against what is drawn.
 */
function NarrationRibbonImpl({ sceneStartMs }: { sceneStartMs: number }) {
  const panel = useStoryboardStore((s) => s.storyboardPanels[s.activeClipIndex]);

  const segments = useMemo<Segment[]>(() => {
    if (!panel) return [];
    const beats = panel.beats?.length
      ? panel.beats
      : panel.narration
        ? [{ narration: panel.narration, durationSec: (panel.audioDurationMs ?? 0) / 1000 }]
        : [];
    let cursor = 0;
    return beats
      .map((beat) => {
        const measured = "audioDurationMs" in beat ? beat.audioDurationMs : undefined;
        const durationMs = measured ?? Math.round((beat.durationSec ?? 0) * 1000);
        const offset = "startMs" in beat && typeof beat.startMs === "number" ? beat.startMs : cursor;
        cursor = offset + durationMs;
        return { text: beat.narration.trim(), startMs: sceneStartMs + offset, endMs: sceneStartMs + cursor };
      })
      .filter((segment) => segment.text);
  }, [panel, sceneStartMs]);

  // The clock ticks every frame: only a change of spoken segment re-renders.
  const progressRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = () => {
      const t = useUnifiedEngineStore.getState().timeline.currentTime;
      const idx = segments.findIndex((s) => t >= s.startMs && t < s.endMs);
      setActiveIdx((prev) => (prev === idx ? prev : idx));
      const segment = segments[idx];
      if (segment && progressRef.current) {
        progressRef.current.style.width = `${((t - segment.startMs) / Math.max(1, segment.endMs - segment.startMs)) * 100}%`;
      }
    };
    place();
    return useUnifiedEngineStore.subscribe(place);
  }, [segments]);

  useEffect(() => {
    scrollerRef.current
      ?.querySelector<HTMLElement>(`[data-segment="${activeIdx}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  if (segments.length === 0) return null;

  return (
    <div
      ref={scrollerRef}
      className="flex h-10 shrink-0 items-stretch gap-1 overflow-x-auto border-b border-border px-2 py-1.5"
    >
      {segments.map((segment, idx) => {
        const color = ANNOTATION_PALETTE[idx % ANNOTATION_PALETTE.length].stroke;
        const active = idx === activeIdx;
        return (
          <button
            key={idx}
            type="button"
            data-segment={idx}
            title={segment.text}
            onClick={() => useUnifiedEngineStore.getState().setCurrentTime(segment.startMs)}
            className={`relative flex min-w-0 max-w-72 shrink-0 items-center gap-1.5 overflow-hidden rounded-md pl-2 pr-2.5 text-left text-xs transition-colors ${
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <span aria-hidden className="h-4 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="shrink-0 font-mono text-[10px] tabular-nums opacity-70">{idx + 1}</span>
            <span className="truncate">{segment.text}</span>
            {active && (
              <span className="absolute inset-x-0 bottom-0 h-0.5">
                <span ref={progressRef} className="block h-full" style={{ backgroundColor: color }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const NarrationRibbon = memo(NarrationRibbonImpl);
