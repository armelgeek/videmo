"use client";

import { useEffect, useRef } from "react";

import { subscribeToPlaybackPosition, readPlaybackPosition } from "../playback-clock";

interface PlayheadCursorProps {
  zoomLevel: number;
  isDragging: boolean;
  onStartDrag: () => void;
}

/**
 * The playhead cursor.
 *
 * It follows the clock WITHOUT going through React rendering: the subscription
 * sets the `transform` directly. Rendering this component every frame would
 * already be far cheaper than rendering the whole timeline, but this cursor
 * changes only one thing — its position — and a style assignment changes it
 * faster than any render.
 *
 * The rest of its appearance (thickness, colour while dragging) comes from
 * ordinary props: it does not change per frame.
 */
export function PlayheadCursor({
  zoomLevel,
  isDragging,
  onStartDrag,
}: PlayheadCursorProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  // Zoom is read by the subscription, which is not recreated on every zoom
  // change: without this ref it would set the position at the old scale.
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;

  useEffect(() => {
    const placer = () => {
      const el = elementRef.current;
      if (!el) return;
      el.style.transform = `translateX(${readPlaybackPosition() * zoomRef.current}px)`;
    };
    placer();
    return subscribeToPlaybackPosition(placer);
  }, []);

  // A zoom change does not go through the clock: the cursor must be
  // repositioned here, otherwise it stays at its pre-zoom pixel position.
  useEffect(() => {
    const el = elementRef.current;
    if (el) el.style.transform = `translateX(${readPlaybackPosition() * zoomLevel}px)`;
  }, [zoomLevel]);

  return (
    <div ref={elementRef} className="absolute top-0 bottom-0 z-50 group/playhead">
      {/* Hit Area */}
      <div
        className="absolute -left-2 w-4 h-full cursor-ew-resize z-50"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onStartDrag();
        }}
      />
      {/* Visual Line */}
      <div
        className={`absolute left-0 w-0.5 h-full bg-red-500 pointer-events-none shadow-[0_0_6px_rgba(239,68,68,0.6)] ${
          isDragging
            ? "w-1 bg-red-400 shadow-[0_0_12px_rgba(239,68,68,1)]"
            : ""
        }`}
      />
      {/* Head/Handle */}
      <div
        className={`absolute -left-[5.5px] top-0 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] pointer-events-none transition-colors ${
          isDragging
            ? "border-t-white"
            : "border-t-[var(--accent-primary)] group-hover/playhead:border-t-[var(--accent-text)]"
        }`}
      />
    </div>
  );
}
