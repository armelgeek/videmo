"use client";

import { useEffect, useState } from "react";
import { markerGeometry, type TransitionMarker } from "../timeline/transition-marker-geometry";
import type { ClipWindow } from "../timeline/clip-transitions";
import { TRACK_HEADER_PX } from "../timeline/annotation-timeline";

/** Une couleur distincte par type, pour reconnaitre la transition d'un coup d'oeil. */
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
  /** Branche en Task 4. Duree en ms proposee pour le panneau `panelIdx`. */
  onResize?: (panelIdx: number, durationMs: number) => void;
}

/**
 * Une carte par frontiere de clip transitionnee, superposee a la timeline —
 * meme patron que TimelinePlayhead : positionnee par pixels-par-seconde et
 * scroll offset venus du viewport partage, pas par une Timeline qui ne
 * connait pas ce concept.
 */
export function ClipTransitionMarkers({ clips, viewport, onResize }: ClipTransitionMarkersProps) {
  const scrollEl = viewport?.scrollEl ?? null;
  const zoomLevel = viewport?.zoomLevel ?? 0;
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    if (!scrollEl) return;
    const onScroll = () => setScrollLeft(scrollEl.scrollLeft);
    onScroll();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [scrollEl]);

  if (!viewport || zoomLevel <= 0) return null;

  const pxParMs = zoomLevel / 1000;
  const marqueurs = markerGeometry(clips, pxParMs);

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {marqueurs.map((m) => (
        <TransitionCard
          key={m.panelIdx}
          marqueur={m}
          type={clips[m.panelIdx].transition?.type ?? "fade"}
          scrollLeft={scrollLeft}
        />
      ))}
    </div>
  );
}

function TransitionCard({
  marqueur,
  type,
  scrollLeft,
}: {
  marqueur: TransitionMarker;
  type: string;
  scrollLeft: number;
}) {
  const left = TRACK_HEADER_PX + marqueur.x - scrollLeft;
  const couleur = COULEUR_PAR_TYPE[type] ?? COULEUR_PAR_TYPE.fade;

  return (
    <div
      className="absolute top-0 bottom-0 rounded-sm pointer-events-auto"
      style={{
        left,
        width: Math.max(4, marqueur.width),
        backgroundColor: couleur,
        opacity: 0.55,
      }}
      title={`Transition : ${type}`}
    />
  );
}
