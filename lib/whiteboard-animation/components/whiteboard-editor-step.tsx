"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { WhiteboardConfigPanel } from "./whiteboard-config-panel";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useUnifiedEngine } from "@/lib/unified-engine/hooks/useUnifiedEngine";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { toEngineAnnotations } from "../timeline/annotation-interop";
import { useWhiteboardRenderer } from "../hooks/use-whiteboard-renderer";
import { deriveTimeline } from "../timeline/derive-timeline";
import { AnnotationTimeline } from "../timeline/annotation-timeline";
import { AnnotationListPanel } from "./annotation-list-panel";
import { AudioTrackRow } from "./audio-track-row";
import { TimelinePlayhead } from "./timeline-playhead";
import type { WhiteboardConfig } from "@/lib/storyboard/store";
import { useStoryboardStore } from "@/lib/storyboard/store";
import { DEMO_STORYBOARD } from "@/lib/demo-data";
import { tailleCanvas, cssAspectRatio, type RatioProjet } from "../canvas-size";
import { ClipSelectorBar } from "./clip-selector-bar";


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

  const storyboardPanels = useStoryboardStore((s) => s.storyboardPanels);
  const activeClipIndex = useStoryboardStore((s) => s.activeClipIndex);

  const activePanel = storyboardPanels[activeClipIndex] || storyboardPanels[0];

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
  const { isOverlayHidden } = useWhiteboardRenderer({
    canvasRef,
    canvasWidth,
    canvasHeight,
    handCanvasRef,
    imageUrl:
      activePanel?.imageUrl ||
      DEMO_STORYBOARD.panels[activeClipIndex % DEMO_STORYBOARD.panels.length]?.imageUrl ||
      "/scene-premium-bag.png",
    audioUrl: config.audio?.url ?? null,
    audioVolume: config.audio?.volume ?? 1,
    audioMuted: config.audio?.muted ?? false,
    audioDurationMs: config.audio?.durationMs ?? null,
    savedAnnotations: activePanel?.annotations
      ? toEngineAnnotations(activePanel.annotations)
      : config.annotations
        ? toEngineAnnotations(config.annotations)
        : null,
  });

  // ── Global timeline sequence ─────────────────────────────────────────────
  // All panels' annotations chained end-to-end for the timeline display.
  // Each id is prefixed with its panel index to stay unique across panels.
  const allAnnotations = useMemo(() => {
    return storyboardPanels.flatMap((panel, panelIdx) =>
      toEngineAnnotations(panel.annotations || []).map((a) => ({
        ...a,
        id: `p${panelIdx}-${a.id}`,
      }))
    );
  }, [storyboardPanels]);

  // Panel time boundaries derived from the global sequence.
  // Used to auto-switch activeClipIndex as the playhead moves.
  const panelBoundaries = useMemo(() => {
    if (allAnnotations.length === 0) return [];
    const derived = deriveTimeline(allAnnotations);
    const result: { panelIdx: number; startMs: number; endMs: number }[] = [];
    derived.annotations.forEach((ann) => {
      const match = ann.id.match(/^p(\d+)-/);
      if (!match) return;
      const pi = parseInt(match[1], 10);
      const last = result[result.length - 1];
      if (last && last.panelIdx === pi) {
        last.endMs = ann.reveal.to;
      } else {
        result.push({ panelIdx: pi, startMs: ann.reveal.from, endMs: ann.reveal.to });
      }
    });
    return result;
  }, [allAnnotations]);

  // ── Engine store = active panel only (canvas + Konva overlay) ────────────
  const activePanelAnnotations = useMemo(
    () => toEngineAnnotations(activePanel?.annotations || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeClipIndex, storyboardPanels],
  );

  useEffect(() => {
    useUnifiedEngineStore.getState().setAnnotations(activePanelAnnotations);
  }, [activePanelAnnotations]);

  // ── Current playback position (for indicator) ──────────────────────────────
  // Tracks which clip/annotation is currently playing in the global timeline.
  const engineCurrentTime = useUnifiedEngineStore((s) => s.timeline.currentTime);

  const currentPlayingClip = useMemo(() => {
    if (!panelBoundaries.length) return null;
    return (
      panelBoundaries.find(
        (b) => engineCurrentTime >= b.startMs && engineCurrentTime <= b.endMs,
      ) ?? (engineCurrentTime > 0 ? panelBoundaries[panelBoundaries.length - 1] : null)
    );
  }, [engineCurrentTime, panelBoundaries]);

  const currentPlayingAnnotation = useMemo(() => {
    if (!allAnnotations.length || !currentPlayingClip) return null;
    return allAnnotations.find(
      (a) => engineCurrentTime >= a.reveal.from && engineCurrentTime <= a.reveal.to,
    );
  }, [engineCurrentTime, allAnnotations, currentPlayingClip]);

  // Auto-switch to clip currently playing
  const setActiveClipIndex = useStoryboardStore((s) => s.setActiveClipIndex);
  useEffect(() => {
    if (currentPlayingClip && currentPlayingClip.panelIdx !== activeClipIndex) {
      setActiveClipIndex(currentPlayingClip.panelIdx);
    }
  }, [currentPlayingClip?.panelIdx, activeClipIndex, setActiveClipIndex]);

  // Sync config with engine
  useEffect(() => {
    setAnimStyle(config.animStyle);
    setHandStyle(config.handStyle);
    setRevealSpeed(config.revealSpeed);
    setHandSpeed(config.handSpeed);
    setChunks(config.chunks);
    setCanvasBg("white");
  }, [config]);

  // Reset animation when needed
  const resetAnimation = () => {
    setCurrentTime(0);
  };

  return (
    <div className="w-full h-full flex gap-4 overflow-hidden">
      {/* Column 1: Vertical Clip Selector Sidebar */}
      <ClipSelectorBar />

      {/* Column 2: Canvas Preview & Annotation Timeline */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 justify-start overflow-y-auto">
        {/* Canvas Container */}
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

        {/* Playback indicator */}
        {currentPlayingClip && (
          <div className="shrink-0 px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg">
            <div className="text-xs font-semibold text-primary">
              Playing: Clip {currentPlayingClip.panelIdx + 1}
              {currentPlayingAnnotation && ` • ${currentPlayingAnnotation.id.split("-")[1]}`}
            </div>
            {currentPlayingAnnotation && (
              <div className="text-xs text-muted-foreground mt-1">
                {currentPlayingAnnotation.text || `${(currentPlayingAnnotation.reveal.from / 1000).toFixed(2)}s - ${(currentPlayingAnnotation.reveal.to / 1000).toFixed(2)}s`}
              </div>
            )}
          </div>
        )}

        {/* Annotation timeline, with the narration lane below it. The playhead
            is drawn by the timeline itself, so the lane has to borrow the same
            scale and scroll offset to stay under it. */}
        <div className="relative">
          <AnnotationTimeline onViewportChange={setTimelineViewport} globalAnnotations={allAnnotations} />
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
