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

  // La couche se cale explicitement sur la BANDE ANNOTATION, pas sur tout
  // `inset-0` du parent ni sur tout scrollEl : ce dernier contient la regle
  // ET les pistes empilees (Timeline les rend dans le meme conteneur
  // scrollable — voir lib/editor/components/timeline.tsx, scrollContainerRef
  // enveloppe TimelineRuler et les pistes). S'y caler sans corriger etirait la
  // carte sur toute cette hauteur, regle comprise.
  //
  // RULER_HEIGHT_PX = 32 : hauteur fixe de TimelineRuler (`h-8`,
  // timeline-ruler.tsx). ANNOTATION_ROW_HEIGHT_PX = 44 : hauteur mesuree d'un
  // bloc d'annotation a l'ecran — la seule piste que cette timeline rend
  // (use-annotation-timeline.ts : "a single fixed track").
  // TimelinePlayhead traverse volontairement toutes les pistes ; une carte de
  // transition doit au contraire rester confinee a celle des blocs.
  const ref = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState({ top: 0 });

  useEffect(() => {
    if (!scrollEl) return;
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
    const onScroll = () => setScrollLeft(scrollEl.scrollLeft);
    onScroll();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", place);
    const observer = new ResizeObserver(place);
    observer.observe(scrollEl);
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
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
      className="absolute pointer-events-none z-30"
      style={{ top: rect.top, height: ANNOTATION_ROW_HEIGHT_PX, left: 0, right: 0 }}
    >
      {marqueurs.map((m) => {
        const left = TRACK_HEADER_PX + m.x - scrollLeft;
        const isVisible = left + Math.max(4, m.width) > TRACK_HEADER_PX;
        return isVisible ? (
          <TransitionCard
            key={m.panelIdx}
            marqueur={m}
            type={clips[m.panelIdx].transition?.type ?? "fade"}
            scrollLeft={scrollLeft}
            pxParMs={pxParMs}
            blancMs={clips[m.panelIdx + 1].startMs - clips[m.panelIdx].endMs}
            onResize={onResize}
          />
        ) : null;
      })}
    </div>
  );
}

function TransitionCard({
  marqueur,
  type,
  scrollLeft,
  pxParMs,
  blancMs,
  onResize,
}: {
  marqueur: TransitionMarker;
  type: string;
  scrollLeft: number;
  pxParMs: number;
  /** Largeur du blanc disponible a cette frontiere, en ms — plafond du drag. */
  blancMs: number;
  onResize?: (panelIdx: number, durationMs: number) => void;
}) {
  const left = TRACK_HEADER_PX + marqueur.x - scrollLeft;
  const couleur = COULEUR_PAR_TYPE[type] ?? COULEUR_PAR_TYPE.fade;

  // Meme protocole que TimelinePlayhead.startDrag : mousedown local,
  // mousemove/mouseup sur document pour suivre le curseur hors de la carte.
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pxParMs <= 0 || !onResize) return;

    const x0 = e.clientX;
    const largeurInitialeMs = marqueur.width / pxParMs;

    const onMove = (ev: MouseEvent) => {
      const deltaMs = (ev.clientX - x0) / pxParMs;
      const dureeMs = Math.round(
        Math.min(blancMs, Math.max(50, largeurInitialeMs + deltaMs)),
      );
      onResize(marqueur.panelIdx, dureeMs);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

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
    >
      {/* Poignee : bord droit, zone de prise elargie pour rester saisissable
          meme quand la carte est etroite. */}
      <div
        className="absolute -right-1 top-0 bottom-0 w-3 cursor-ew-resize"
        onMouseDown={startDrag}
      />
    </div>
  );
}
