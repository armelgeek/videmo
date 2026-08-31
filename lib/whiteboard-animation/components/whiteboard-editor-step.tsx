"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { WhiteboardConfigPanel } from "./whiteboard-config-panel";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useUnifiedEngine } from "@/lib/unified-engine/hooks/useUnifiedEngine";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import {
  toEngineAnnotations,
  toStoredAnnotations,
} from "../timeline/annotation-interop";
import { useWhiteboardRenderer } from "../hooks/use-whiteboard-renderer";
import { AnnotationTimeline } from "../timeline/annotation-timeline";
import { AnnotationListPanel } from "./annotation-list-panel";
import { AudioTrackRow } from "./audio-track-row";
import { TimelinePlayhead } from "./timeline-playhead";
import type { WhiteboardConfig } from "@/lib/storyboard/store";
import { tailleCanvas, cssAspectRatio, type RatioProjet } from "../canvas-size";

/** Konva touche `window` des son chargement : pas d'evaluation au rendu serveur. */
const AnnotationOverlay = dynamic(
  () => import("./annotation-overlay").then((m) => m.AnnotationOverlay),
  { ssr: false },
);

interface WhiteboardEditorStepProps {
  config: WhiteboardConfig;
  /** Ratio du PROJET (projectParams), seule source pour la forme du canvas. */
  aspectRatio: RatioProjet;
  onConfigChange: (config: Partial<WhiteboardConfig>) => void;
  onNavigateBack?: () => void;
  onNavigateNext?: () => void;
  /** Libelle du bouton d'avancement. Le whiteboard etant la DERNIERE etape, ce
   *  n'est plus un "Next" mais une action de fin de parcours. */
  nextLabel?: string;
}

export function WhiteboardEditorStep({
  config,
  aspectRatio,
  onConfigChange,
  onNavigateBack,
  onNavigateNext,
  nextLabel = "Next →",
}: WhiteboardEditorStepProps) {
  // Shared so the narration lane lines up with the timeline ruler above it.
  const [timelineViewport, setTimelineViewport] = useState<
    | { scrollEl: HTMLElement | null; contentWidth: number; zoomLevel: number }
    | undefined
  >(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);

  const { width: canvasWidth, height: canvasHeight } =
    tailleCanvas(aspectRatio);

  // Connect to unified engine
  const {
    progress,
    animStyle,
    setAnimStyle,
    handStyle,
    setHandStyle,
    revealSpeed,
    setRevealSpeed,
    handSpeed,
    setHandSpeed,
    chunks,
    setChunks,
    setCanvasBg,
    annotations,
    setCurrentTime,
  } = useUnifiedEngine();

  // Enable canvas rendering.
  // Pas d'annotationCanvasRef : les regions sont rendues par AnnotationOverlay
  // (Konva), qui les rend deplacables et redimensionnables la ou le trace
  // imperatif n'etait qu'un repere inerte.
  const { isOverlayHidden } = useWhiteboardRenderer({
    canvasRef,
    canvasWidth,
    canvasHeight,
    handCanvasRef,
    // Muted still plays (silently) to keep serving as the clock — only the
    // absence of a track falls back to wall-clock timing.
    audioUrl: config.audio?.url ?? null,
    audioVolume: config.audio?.volume ?? 1,
    audioMuted: config.audio?.muted ?? false,
    // The video lasts as long as its narration, and this length survives a
    // media element that stalls before reporting one.
    audioDurationMs: config.audio?.durationMs ?? null,
    savedAnnotations: config.annotations
      ? toEngineAnnotations(config.annotations)
      : null,
  });

  // Mirror timeline edits into the saved project. The editor works on the
  // engine store, which is memory only; the persisted copy lives in
  // whiteboardConfig, and nothing connected the two — so resizing a clip
  // survived until the next reload and no further.
  const engineAnnotations = useUnifiedEngineStore(
    (s) => s.animation.annotations,
  );
  useEffect(() => {
    // Never write an empty set: on mount the engine store is still empty and
    // this would erase the very annotations we are about to seed from.
    if (engineAnnotations.length === 0) return;
    onConfigChange({ annotations: toStoredAnnotations(engineAnnotations) });
  }, [engineAnnotations]);

  // Sync config with engine (Zustand setters are stable, safe to use without listing as deps)
  useEffect(() => {
    setAnimStyle(config.animStyle);
    setHandStyle(config.handStyle);
    setRevealSpeed(config.revealSpeed);
    setHandSpeed(config.handSpeed);
    setChunks(config.chunks);
    // Le fond est toujours blanc : le reglage a ete retire du panneau, mais
    // un projet enregistre avant peut encore porter "black" ou "none".
    setCanvasBg("white");
  }, [config]); // Only config, not the setters which are stable from Zustand

  // Reset animation when needed
  const resetAnimation = () => {
    setCurrentTime(0);
  };

  return (
    <div className="w-full h-full flex gap-4 overflow-hidden">
      {/* Left: Canvas Preview */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-4 justify-start">
        {/* Canvas Container — suit le ratio du projet et reste plafonne en
            hauteur pour que le timeline et la lecture restent au-dessus de la
            ligne de flottaison. */}
        <div
          className="shrink-0 mx-auto w-full rounded-lg border border-white/10 bg-black overflow-hidden relative"
          style={{
            aspectRatio: cssAspectRatio(aspectRatio),
            maxWidth: `min(100%, calc(52vh * ${canvasWidth} / ${canvasHeight}))`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full object-contain"
          />
          <canvas
            ref={handCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
          {/* Calque d'edition des annotations. Il masque le dessin qu'on est
              venu regarder : il s'efface donc pendant la lecture et revient a
              l'arret, fin de lecture comprise — d'ou isOverlayHidden, que
              use-whiteboard-renderer calcule en sachant aussi quand on scrube. */}
          <AnnotationOverlay
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            hidden={isOverlayHidden}
          />
        </div>

        {/* Annotation timeline, with the narration lane below it. The playhead
            is drawn by the timeline itself, so the lane has to borrow the same
            scale and scroll offset to stay under it. */}
        <div className="relative">
          <AnnotationTimeline onViewportChange={setTimelineViewport} />
          <AudioTrackRow viewport={timelineViewport} />
          <TimelinePlayhead viewport={timelineViewport} />
        </div>

        {/* Play/pause lives in the timeline toolbar; only reset is extra. */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetAnimation}
            className="flex gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Right: reglages, puis la sequence d'annotations. C'est cette liste qui
          justifie le rail : elle a besoin de toute la hauteur disponible, la ou
          deux controles seuls ne la remplissaient pas. */}
      <div className="w-72 shrink-0 min-h-0 flex flex-col gap-3">
        <WhiteboardConfigPanel
          config={config}
          onChange={(updates) => {
            // Le store pour la persistance, le moteur pour le rendu.
            onConfigChange(updates);
            if (updates.animStyle) setAnimStyle(updates.animStyle);
            if (updates.handStyle) setHandStyle(updates.handStyle);
            if (updates.revealSpeed !== undefined)
              setRevealSpeed(updates.revealSpeed);
            if (updates.handSpeed !== undefined) setHandSpeed(updates.handSpeed);
            if (updates.chunks !== undefined) setChunks(updates.chunks);
          }}
        />

        <AnnotationListPanel className="flex-1" />

        <div className="flex shrink-0 gap-2 border-t pt-3">
          <Button variant="outline" onClick={onNavigateBack} className="flex-1">
            ← Back
          </Button>
          <Button
            onClick={onNavigateNext}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
