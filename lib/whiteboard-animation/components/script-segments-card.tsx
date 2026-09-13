"use client";

import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStoryboardStore } from "@/lib/storyboard/store";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import type { StoryboardPanel } from "@/lib/storyboard/schema";
import type { NarrationPart } from "../audio/narration-schedule";
import { annotationColors } from "../schema";

/** Alternates so two neighbouring segments stay apart; colour comes from the annotation. */
const VARIANTS = ["tinted", "underline"] as const;

export interface SegmentWindow {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * Where each beat of a scene is heard on the project clock.
 *
 * A beat's `startMs` is its offset inside its recording, and one recording
 * usually carries the whole script: the recording's own start on the clock
 * has to be added, not the scene's. A beat not recorded yet falls back to its
 * estimated duration, chained from the scene start.
 */
export function segmentWindows(
  panel: Pick<StoryboardPanel, "beats" | "narration" | "audioDurationMs">,
  parts: readonly NarrationPart[],
  sceneStartMs: number,
): SegmentWindow[] {
  const beats = panel.beats?.length
    ? panel.beats
    : panel.narration
      ? [{ narration: panel.narration, durationSec: (panel.audioDurationMs ?? 0) / 1000 }]
      : [];

  let cursor = sceneStartMs;
  const windows: SegmentWindow[] = [];
  for (const beat of beats) {
    const text = beat.narration.trim();
    const estimatedMs = Math.round((beat.durationSec ?? 0) * 1000);
    const part =
      "audioUrl" in beat && beat.audioUrl ? parts.find((p) => p.url === beat.audioUrl) : undefined;
    const measured = "audioDurationMs" in beat ? beat.audioDurationMs : undefined;
    const offset = "startMs" in beat ? beat.startMs : undefined;

    const startMs = part && typeof offset === "number" ? part.startMs + offset : cursor;
    const endMs = startMs + (measured ?? estimatedMs);
    cursor = endMs;
    if (text) windows.push({ text, startMs, endMs });
  }
  return windows;
}

/** The segment heard at `t`, or the last one started when `t` falls in a gap. */
function segmentAt(segments: SegmentWindow[], t: number): number {
  let lastStarted = 0;
  for (let i = 0; i < segments.length; i++) {
    if (t >= segments[i].startMs && t < segments[i].endMs) return i;
    if (segments[i].startMs <= t) lastStarted = i;
  }
  return lastStarted;
}

/**
 * The narration being spoken, one segment at a time: the whole script would
 * not fit above the timeline, the current beat always does.
 */
function ScriptSegmentsCardImpl({ sceneStartMs }: { sceneStartMs: number }) {
  const panel = useStoryboardStore((s) => s.storyboardPanels[s.activeClipIndex]);
  const parts = useStoryboardStore((s) => s.whiteboardConfig.narration);

  const segments = useMemo(
    () => (panel ? segmentWindows(panel, parts ?? [], sceneStartMs) : []),
    [panel, parts, sceneStartMs],
  );

  // Follows the clock outside React; only a change of segment re-renders.
  const [current, setCurrent] = useState(0);
  const lastRef = useRef(-1);
  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    lastRef.current = -1;
    const place = () => {
      if (segments.length === 0) return;
      const t = useUnifiedEngineStore.getState().timeline.currentTime;
      const idx = segmentAt(segments, t);
      const segment = segments[idx];
      if (progressRef.current) {
        const ratio = (t - segment.startMs) / Math.max(1, segment.endMs - segment.startMs);
        progressRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
      }
      if (idx === lastRef.current) return;
      lastRef.current = idx;
      setCurrent(idx);
    };
    place();
    return useUnifiedEngineStore.subscribe(place);
  }, [segments]);

  if (segments.length === 0) return null;

  const idx = Math.min(current, segments.length - 1);
  // The segment shares the colour of the annotation at the same rank.
  const accent = annotationColors(panel?.annotations?.[idx] ?? {}, idx).stroke;
  const variant = VARIANTS[idx % VARIANTS.length];
  const words = segments[idx].text.split(/\s+/).filter(Boolean);
  const goTo = (target: number) =>
    useUnifiedEngineStore.getState().setCurrentTime(segments[target].startMs);

  return (
    <div className="relative flex shrink-0 items-center gap-3 overflow-hidden rounded-lg border border-border bg-card px-4 py-2.5 text-foreground">
      <p
        key={idx}
        className="line-clamp-2 min-w-0 flex-1 text-center animate-in fade-in duration-300"
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 12.5,
          lineHeight: 1.85,
        }}
      >
        {words.map((word, wordIdx) => (
          <Fragment key={wordIdx}>
            <span style={{ whiteSpace: wordIdx === 0 ? "nowrap" : undefined }}>
              {wordIdx === 0 && (
                <span
                  style={{
                    background: accent,
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: 999,
                    marginRight: 6,
                    verticalAlign: "1px",
                  }}
                >
                  #{idx + 1}
                </span>
              )}
              <span
                style={
                  variant === "tinted"
                    ? { color: accent, fontWeight: 600, borderBottom: `2px dotted ${accent}` }
                    : { fontWeight: 700, borderBottom: `3px solid ${accent}` }
                }
              >
                {word}
              </span>
              {wordIdx === words.length - 1 && (
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: "1.2em",
                    marginLeft: 4,
                    borderRadius: 1,
                    background: accent,
                    verticalAlign: "-3px",
                  }}
                />
              )}
            </span>{" "}
          </Fragment>
        ))}
      </p>

      <div
        className="flex shrink-0 items-center rounded-full border border-border text-[11px] tabular-nums text-muted-foreground"
      >
        <button
          type="button"
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0}
          aria-label="Previous segment"
          className="rounded-l-full py-1 pl-1.5 pr-1 hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="px-1 text-foreground">
          {idx + 1}
          <span className="opacity-40"> / {segments.length}</span>
        </span>
        <button
          type="button"
          onClick={() => goTo(idx + 1)}
          disabled={idx === segments.length - 1}
          aria-label="Next segment"
          className="rounded-r-full py-1 pl-1 pr-1.5 hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-muted">
        <div
          ref={progressRef}
          className="h-full origin-left"
          style={{ background: accent, transform: "scaleX(0)" }}
        />
      </div>
    </div>
  );
}

export const ScriptSegmentsCard = memo(ScriptSegmentsCardImpl);
