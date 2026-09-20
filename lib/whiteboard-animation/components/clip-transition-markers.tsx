"use client";

import { memo, useEffect, useRef, useState } from "react";
import { markerGeometry, type TransitionMarker } from "../timeline/transition-marker-geometry";
import type { ClipWindow } from "../timeline/clip-transitions";
import { TRACK_HEADER_PX } from "../timeline/annotation-timeline";

/** A distinct colour per type, to recognise the transition at a glance. */
const RULER_HEIGHT_PX = 32;
const ANNOTATION_ROW_HEIGHT_PX = 44;

const COLOR_BY_TYPE: Record<string, string> = {
  fade: "#a855f7",
  slideup: "#38bdf8",
  slidedown: "#38bdf8",
  slideleft: "#38bdf8",
  slideright: "#38bdf8",
};

export interface ClipTransitionMarkersProps {
  clips: ClipWindow[];
  /** Same shape as TimelinePlayhead: the timeline's shared viewport. */
  viewport?: {
    scrollEl: HTMLElement | null;
    contentWidth: number;
    zoomLevel: number;
  };
  /** Proposed duration in ms for panel `panelIdx`. */
  onResize?: (panelIdx: number, durationMs: number) => void;
}

/**
    * One card per transitioned clip boundary, overlaid on the timeline —
    * uses imperative scroll tracking (like AudioTrackRow and TimelinePlayhead)
    * to avoid React latency while scrolling.
  */
function ClipTransitionMarkersImpl({ clips, viewport, onResize }: ClipTransitionMarkersProps) {
  const scrollEl = viewport?.scrollEl ?? null;
  const zoomLevel = viewport?.zoomLevel ?? 0;

  const ref = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState({ top: 0 });

  useEffect(() => {
    if (!scrollEl) return;

    const applyScroll = () => {
      const offset = scrollEl.scrollLeft;
      if (laneRef.current) {
        laneRef.current.style.transform = `translateX(${-offset}px)`;
      }
    };

    const place = () => {
      const parent = ref.current?.parentElement;
      if (!parent) return;
      const top =
        scrollEl.getBoundingClientRect().top -
        parent.getBoundingClientRect().top +
        RULER_HEIGHT_PX;
      setRect({ top: Math.max(0, top) });
    };

    place();
    applyScroll();

    scrollEl.addEventListener("scroll", applyScroll, { passive: true });
    window.addEventListener("resize", place);
    const observer = new ResizeObserver(place);
    observer.observe(scrollEl);

    return () => {
      scrollEl.removeEventListener("scroll", applyScroll);
      window.removeEventListener("resize", place);
      observer.disconnect();
    };
  }, [scrollEl, zoomLevel]);

  if (!viewport || zoomLevel <= 0) return null;

  const pxPerMs = zoomLevel / 1000;
  const markers = markerGeometry(clips, pxPerMs);

  return (
    <div
      ref={ref}
      className="absolute pointer-events-none z-30 overflow-hidden"
      style={{
        top: rect.top,
        height: ANNOTATION_ROW_HEIGHT_PX,
        left: TRACK_HEADER_PX,
        right: 0,
      }}
    >
      <div
        ref={laneRef}
        className="relative h-full"
        style={{ width: viewport.contentWidth }}
      >
        {markers.map((m) => {
          const left = m.x;
          return (
            <TransitionCard
              key={m.panelIdx}
              marker={m}
              left={left}
              type={clips[m.panelIdx]?.transition?.type ?? "fade"}
              pxPerMs={pxPerMs}
              onResize={onResize}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Does not follow the clock: memo avoids re-rendering at its parent's pace. */
export const ClipTransitionMarkers = memo(ClipTransitionMarkersImpl);

function TransitionCard({
  marker,
  left,
  type,
  pxPerMs,
  onResize,
}: {
  marker: TransitionMarker;
  left: number;
  type: string;
  pxPerMs: number;
  onResize?: (panelIdx: number, durationMs: number) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const color = COLOR_BY_TYPE[type] ?? COLOR_BY_TYPE.fade;

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pxPerMs <= 0 || !onResize) return;

    const x0 = e.clientX;
    const initialWidthMs = marker.width / pxPerMs;
    let latestDurationMs = Math.max(50, Math.round(initialWidthMs));
    let rafId: number | null = null;

    const onMove = (ev: MouseEvent) => {
      const deltaMs = (ev.clientX - x0) / pxPerMs;
      latestDurationMs = Math.max(50, Math.round(initialWidthMs + deltaMs));

      if (cardRef.current) {
        cardRef.current.style.width = `${Math.max(4, latestDurationMs * pxPerMs)}px`;
      }

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          onResize(marker.panelIdx, latestDurationMs);
        });
      }
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      onResize(marker.panelIdx, latestDurationMs);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={cardRef}
      className="absolute top-0 bottom-0 rounded-sm pointer-events-auto"
      style={{
        left,
        width: Math.max(4, marker.width),
        backgroundColor: color,
        opacity: 0.55,
      }}
      title={`Transition : ${type}`}
    >
      <div
        className="absolute -right-1 top-0 bottom-0 w-3 cursor-ew-resize"
        onMouseDown={startDrag}
      />
    </div>
  );
}

