"use client";

import { useEffect, useRef } from "react";

import { abonnerPositionLecture, lirePositionLecture } from "../playback-clock";

interface PlayheadCursorProps {
  zoomLevel: number;
  isDragging: boolean;
  onStartDrag: () => void;
}

/**
 * Le curseur de lecture.
 *
 * Il suit l'horloge SANS passer par le rendu React : l'abonnement pose
 * directement le `transform`. Rendre ce composant a chaque frame serait deja
 * bien moins cher que de rendre la timeline entiere, mais ce curseur ne change
 * qu'une chose — sa position — et une affectation de style la change plus vite
 * que n'importe quel rendu.
 *
 * Le reste de son apparence (epaisseur, couleur pendant un glisser) vient de
 * props ordinaires : ca ne bouge pas a la frame.
 */
export function PlayheadCursor({
  zoomLevel,
  isDragging,
  onStartDrag,
}: PlayheadCursorProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  // Le zoom est lu par l'abonnement, qui ne se refait pas a chaque changement
  // de zoom : sans cette ref il poserait la position a l'ancienne echelle.
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;

  useEffect(() => {
    const placer = () => {
      const el = elementRef.current;
      if (!el) return;
      el.style.transform = `translateX(${lirePositionLecture() * zoomRef.current}px)`;
    };
    placer();
    return abonnerPositionLecture(placer);
  }, []);

  // Un changement de zoom ne passe pas par l'horloge : il faut replacer le
  // curseur ici, sinon il reste a sa position en pixels d'avant le zoom.
  useEffect(() => {
    const el = elementRef.current;
    if (el) el.style.transform = `translateX(${lirePositionLecture() * zoomLevel}px)`;
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
