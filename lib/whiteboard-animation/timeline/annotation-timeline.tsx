"use client";

import React, { useEffect, useRef } from "react";
import { Timeline } from "@/lib/editor/components/timeline";
import { useAnnotationTimeline } from "./use-annotation-timeline";

/**
 * The NLE timeline paints itself from design tokens that only the standalone
 * inkplainer page ever defined, so they resolve to nothing here and every clip
 * comes out transparent. Scoping them to this wrapper keeps the fix local.
 */
const TIMELINE_THEME: React.CSSProperties = {
  "--surface-0": "#0b0b0d",
  "--surface-1": "#141417",
  "--surface-2": "#1e1e23",
  "--surface-3": "#2a2a31",
  "--border-subtle": "rgba(255,255,255,0.06)",
  "--border-default": "rgba(255,255,255,0.12)",
  "--border-emphasis": "rgba(255,255,255,0.24)",
  "--hover-overlay": "rgba(255,255,255,0.04)",
  "--text-primary": "#f4f4f5",
  "--text-secondary": "#c4c4c8",
  "--text-tertiary": "#8e8e96",
  "--text-muted": "#6b6b73",
  "--tertiary": "#a855f7",
  "--accent-primary": "#a855f7",
  "--accent-muted": "rgba(168,85,247,0.5)",
  "--accent-text": "#e9d5ff",
  "--accent-border": "rgba(168,85,247,0.4)",
  "--accent-bg-subtle": "rgba(168,85,247,0.15)",
} as React.CSSProperties;

/**
 * The whiteboard editor's timeline: every clip is an annotation, chained in
 * sequence. Positions are derived, never stored.
 */
/** Width of the track-header gutter that sits left of the clips. Exported so
 *  sibling track rows (e.g. AudioTrackRow) can align their own gutter.
 *
 *  Must match the Timeline's own header (`w-32`). It was 132 against that 128,
 *  which offset every sibling lane by 4px before any scrolling came into it. */
export const TRACK_HEADER_PX = 128;

/**
 * The video editor keeps a full viewport of empty timeline past the last clip
 * so you can scroll beyond it. An annotation sequence has no such need, and the
 * trailing ruler ticks read as time that does not exist.
 *
 * Zero, not merely small: any padding makes the content wider than the zoom
 * fits, and the resulting scroll offsets the playhead against the narration
 * track below, which does not scroll. The playhead would then stop visibly
 * short of the end of the audio it is supposed to be tracking.
 */
const END_PADDING_PX = 0;

export interface AnnotationTimelineProps {
  /** Lets a sibling lane match the ruler's scale and scroll offset. */
  onViewportChange?: (viewport: {
    scrollLeft: number;
    contentWidth: number;
    zoomLevel: number;
  }) => void;
}

export const AnnotationTimeline: React.FC<AnnotationTimelineProps> = ({
  onViewportChange,
}) => {
  const { fitZoomTo, ...timeline } = useAnnotationTimeline();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { duration } = timeline;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const fit = () =>
      fitZoomTo(wrapper.clientWidth - TRACK_HEADER_PX, duration);

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [fitZoomTo, duration]);

  return (
    <div
      ref={wrapperRef}
      style={TIMELINE_THEME}
      className="shrink-0 min-w-0 w-full overflow-hidden border-t border-border"
    >
      <Timeline
        {...timeline}
        endPadding={END_PADDING_PX}
        onViewportChange={onViewportChange}
      />
    </div>
  );
};
