"use client";

import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStoryboardStore } from "@/lib/storyboard/store";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";

const INK = "#1a2340";
const STYLES = [
  { accent: "#e91e8c", variant: "tinted" },
  { accent: "#00d8ff", variant: "underline" },
] as const;

interface Segment {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * The narration being spoken, one segment at a time: the whole script would
 * not fit above the timeline, the current beat always does.
 */
function ScriptSegmentsCardImpl({ sceneStartMs }: { sceneStartMs: number }) {
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

  // Follows the clock outside React; only a change of segment re-renders.
  const [current, setCurrent] = useState(0);
  const lastRef = useRef(0);
  useEffect(() => {
    lastRef.current = 0;
    setCurrent(0);
    const place = () => {
      const t = useUnifiedEngineStore.getState().timeline.currentTime;
      const idx = segments.findIndex((s) => t >= s.startMs && t < s.endMs);
      if (idx === -1 || idx === lastRef.current) return;
      lastRef.current = idx;
      setCurrent(idx);
    };
    place();
    return useUnifiedEngineStore.subscribe(place);
  }, [segments]);

  if (segments.length === 0) return null;

  const idx = Math.min(current, segments.length - 1);
  const { accent, variant } = STYLES[idx % STYLES.length];
  const words = segments[idx].text.split(/\s+/).filter(Boolean);
  const goTo = (target: number) =>
    useUnifiedEngineStore.getState().setCurrentTime(segments[target].startMs);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-white px-4 py-2">
      <p
        className="line-clamp-2 min-w-0 flex-1"
        style={{
          color: INK,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.9,
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
                    padding: "1px 4px",
                    borderRadius: 3,
                    marginRight: 2,
                    verticalAlign: "middle",
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
                    width: 3,
                    height: "1.3em",
                    marginLeft: 3,
                    background: accent,
                    verticalAlign: "middle",
                  }}
                />
              )}
            </span>{" "}
          </Fragment>
        ))}
      </p>

      <div className="flex shrink-0 items-center gap-1 text-[11px] tabular-nums" style={{ color: INK }}>
        <button
          type="button"
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0}
          aria-label="Previous segment"
          className="rounded p-1 hover:bg-black/5 disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span>
          {idx + 1} / {segments.length}
        </span>
        <button
          type="button"
          onClick={() => goTo(idx + 1)}
          disabled={idx === segments.length - 1}
          aria-label="Next segment"
          className="rounded p-1 hover:bg-black/5 disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export const ScriptSegmentsCard = memo(ScriptSegmentsCardImpl);
