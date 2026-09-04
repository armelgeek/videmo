"use client";

import { useEffect, useRef, useState } from "react";
import { markerGeometry, type TransitionMarker } from "../timeline/transition-marker-geometry";
import type { ClipWindow } from "../timeline/clip-transitions";
import { TRACK_HEADER_PX } from "../timeline/annotation-timeline";

/** Une couleur distincte par type, pour reconnaitre la transition d'un coup d'oeil. */
const RULER_HEIGHT_PX = 32;
const ANNOTATION_ROW_HEIGHT_PX = 44;

const COULEUR_PAR_TYPE: Record<string, string> = {
  fade: "#a855f7",
  slideup: "#38bdf8",
  slidedown: "#38bdf8",
  slideleft: "#38bdf8",
  slideright: "#38bdf8",
};

export interface ClipTransitionMarkersProps {
  clips: ClipWindow[];
  /** Meme forme que TimelinePlayhead : viewport partage de la timeline. */
  viewport?: {
    scrollEl: HTMLElement | null;
    contentWidth: number;
    zoomLevel: number;
  };
  /** Duree en ms proposee pour le panneau `panelIdx`. */
  onResize?: (panelIdx: number, durationMs: number) => void;
}

/**
  * Une carte par frontiere de clip transitionnee, superposee a la timeline —
  * utilise le suivi imperatif du scroll (comme AudioTrackRow et TimelinePlayhead)
  * pour eviter la latence React pendant le defilement.
  */
export function ClipTransitionMarkers({ clips, viewport, onResize }: ClipTransitionMarkersProps) {
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

  const pxParMs = zoomLevel / 1000;
  const marqueurs = markerGeometry(clips, pxParMs);

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
        {marqueurs.map((m) => {
          const left = m.x;
          return (
            <TransitionCard
              key={m.panelIdx}
              marqueur={m}
              left={left}
              type={clips[m.panelIdx]?.transition?.type ?? "fade"}
              pxParMs={pxParMs}
              onResize={onResize}
            />
          );
        })}
      </div>
    </div>
  );
}

function TransitionCard({
  marqueur,
  left,
  type,
  pxParMs,
  onResize,
}: {
  marqueur: TransitionMarker;
  left: number;
  type: string;
  pxParMs: number;
  onResize?: (panelIdx: number, durationMs: number) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const couleur = COULEUR_PAR_TYPE[type] ?? COULEUR_PAR_TYPE.fade;

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pxParMs <= 0 || !onResize) return;

    const x0 = e.clientX;
    const largeurInitialeMs = marqueur.width / pxParMs;
    let latestDureeMs = Math.max(50, Math.round(largeurInitialeMs));
    let rafId: number | null = null;

    const onMove = (ev: MouseEvent) => {
      const deltaMs = (ev.clientX - x0) / pxParMs;
      latestDureeMs = Math.max(50, Math.round(largeurInitialeMs + deltaMs));

      if (cardRef.current) {
        cardRef.current.style.width = `${Math.max(4, latestDureeMs * pxParMs)}px`;
      }

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          onResize(marqueur.panelIdx, latestDureeMs);
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
      onResize(marqueur.panelIdx, latestDureeMs);
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
        width: Math.max(4, marqueur.width),
        backgroundColor: couleur,
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

