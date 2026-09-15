"use client";

import React, { useEffect, useRef } from "react";
import { Timeline } from "@/lib/editor/components/timeline";
import { useAnnotationTimeline } from "./use-annotation-timeline";

/**
 * Timeline theme using CSS custom properties that react to light/dark mode.
 * Uses Tailwind's dynamic color system for consistency with the app.
 */
const TIMELINE_THEME: React.CSSProperties = {
  "--surface-0": "hsl(var(--background))",
  "--surface-1": "hsl(var(--card))",
  "--surface-2": "hsl(var(--muted))",
  "--surface-3": "hsl(var(--muted) / 0.5)",
  "--border-subtle": "hsl(var(--border) / 0.3)",
  "--border-default": "hsl(var(--border) / 0.6)",
  "--border-emphasis": "hsl(var(--border))",
  "--hover-overlay": "hsl(var(--border) / 0.15)",
  "--text-primary": "hsl(var(--foreground))",
  "--text-secondary": "hsl(var(--foreground) / 0.8)",
  "--text-tertiary": "hsl(var(--muted-foreground))",
  "--text-muted": "hsl(var(--muted-foreground) / 0.7)",
  "--tertiary": "hsl(var(--primary))",
  "--accent-primary": "hsl(var(--primary))",
  "--accent-muted": "hsl(var(--primary) / 0.4)",
  "--accent-text": "hsl(var(--foreground))",
  "--accent-border": "hsl(var(--primary) / 0.3)",
  "--accent-bg-subtle": "hsl(var(--primary) / 0.1)",
} as React.CSSProperties;

/**
 * The whiteboard editor's timeline: every clip is an annotation, chained in
 * sequence. Positions are derived, never stored.
 */
/** The whiteboard timeline hides its track headers: clips start at the left edge. */
export const TRACK_HEADER_PX = 0;

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

import type { ClipWindow } from "./clip-transitions";

export interface AnnotationTimelineProps {
  /** Lets a sibling lane match the ruler's scale and scroll offset. */
  onViewportChange?: (viewport: {
    scrollEl: HTMLElement | null;
    contentWidth: number;
    zoomLevel: number;
  }) => void;
  /** When provided, the timeline displays this full sequence (all clips
   *  chained) instead of the engine store's active-panel annotations. */
  globalAnnotations?: import("@/lib/unified-engine/types").Annotation[];
  clipWindows?: ClipWindow[];
  onTransitionResize?: (panelIdx: number, durationMs: number) => void;
  onTransitionTypeChange?: (panelIdx: number, type: string) => void;
}

const AnnotationTimelineImpl: React.FC<AnnotationTimelineProps> = ({
  onViewportChange,
  globalAnnotations,
  clipWindows,
  onTransitionResize,
  onTransitionTypeChange,
}) => {
  const { fitZoomTo, ...timeline } = useAnnotationTimeline(globalAnnotations);
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
      className="shrink-0 min-w-0 w-full overflow-hidden"
    >
      <Timeline
        {...timeline}
        endPadding={END_PADDING_PX}
        showPlayhead={false}
        hideTrackHeaders
        hideToolbar
        videoTrackHeight="h-12"
        onViewportChange={onViewportChange}
        clipWindows={clipWindows}
        onTransitionResize={onTransitionResize}
        onTransitionTypeChange={onTransitionTypeChange}
      />
    </div>
  );
};

/**
 * The NLE is the most expensive subtree in the editor, and both of its props
 * are stable — a setState and a memoised sequence. Without this it re-rendered
 * purely because its parent did, which the parent does on every clip handover.
 * It still subscribes to the engine store itself, so the playhead and the
 * clips keep tracking playback.
 */
export const AnnotationTimeline = React.memo(AnnotationTimelineImpl);
