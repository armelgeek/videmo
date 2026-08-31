'use client';

import { useEffect, useRef } from 'react';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import { TRACK_HEADER_PX } from '../timeline/annotation-timeline';

export interface TimelinePlayheadProps {
  /** The timeline's horizontal viewport, so this lines up with its ruler. */
  viewport?: {
    scrollEl: HTMLElement | null;
    contentWidth: number;
    zoomLevel: number;
  };
}

/**
 * One cursor across every lane.
 *
 * Drawing it per lane leaves a seam at each row boundary, so this is a single
 * element spanning from the top of the tracks to the bottom of the last one.
 * The timeline's own playhead is suppressed (`showPlayhead={false}`) rather
 * than overlaid, or the two would fight over the same pixels.
 *
 * Position comes from the shared viewport — pixels-per-second and scroll
 * offset — not from a percentage of the container. The percentage version
 * this replaces only held while the content happened to fit the viewport, and
 * slid away from the clips as soon as anyone zoomed.
 */
export function TimelinePlayhead({ viewport }: TimelinePlayheadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollEl = viewport?.scrollEl ?? null;
  const zoomLevel = viewport?.zoomLevel ?? 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || zoomLevel <= 0) return;

    const place = () => {
      const parent = el.parentElement;
      if (!parent) return;

      // Start at the tracks, not at the toolbar sitting above them.
      if (scrollEl) {
        const top =
          scrollEl.getBoundingClientRect().top -
          parent.getBoundingClientRect().top;
        el.style.top = `${Math.max(0, top)}px`;
      }

      const offset = scrollEl?.scrollLeft ?? 0;
      const ms = useUnifiedEngineStore.getState().timeline.currentTime;
      const x = TRACK_HEADER_PX + (ms / 1000) * zoomLevel - offset;
      el.style.transform = `translateX(${x}px)`;
      // Scrolled behind the track headers it would sit on the gutter and read
      // as a cursor parked at zero.
      el.style.opacity = x < TRACK_HEADER_PX ? '0' : '1';
    };

    place();
    // Subscribed outside React: currentTime changes every frame during
    // playback, and a re-render per frame is what the lanes were rewritten
    // to avoid.
    const unsubscribe = useUnifiedEngineStore.subscribe(place);
    scrollEl?.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      unsubscribe();
      scrollEl?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [scrollEl, zoomLevel, viewport?.contentWidth]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const parent = ref.current?.parentElement;
    if (!parent || zoomLevel <= 0) return;

    const seekTo = (clientX: number) => {
      const left = parent.getBoundingClientRect().left + TRACK_HEADER_PX;
      const offset = scrollEl?.scrollLeft ?? 0;
      const ms = ((clientX - left + offset) / zoomLevel) * 1000;
      useUnifiedEngineStore.getState().setCurrentTime(Math.max(0, ms));
    };

    const onMove = (ev: MouseEvent) => seekTo(ev.clientX);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    seekTo(e.clientX);
  };

  if (!viewport) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-0 left-0 z-40 cursor-ew-resize group/playhead"
      onMouseDown={startDrag}
    >
      {/* Widened hit area, so the 2px line is still grabbable. */}
      <div className="absolute -left-2 top-0 bottom-0 w-4" />
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
      <div className="absolute -left-[5.5px] top-0 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500 pointer-events-none" />
    </div>
  );
}
