"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { WhiteboardConfigPanel } from "./whiteboard-config-panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { useUnifiedEngine } from "@/lib/unified-engine/hooks/useUnifiedEngine";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { toEngineAnnotations, toStoredAnnotations } from "../timeline/annotation-interop";
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
import { ClipTransitionPicker } from "./clip-transition-picker";


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

  // Apercu = on regarde le dessin, sans les cadres ni les poignees.
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // C'est le MODE qui pilote la lecture, et non l'inverse. Les deux sens sont
  // volontairement DISSYMETRIQUES, car ce ne sont pas deux faces d'un meme
  // interrupteur :
  //
  //  - vers l'apercu, on REJOUE le clip depuis son debut. « Montre-moi
  //    l'animation » ne veut pas dire « reprends ou tu en etais » ; c'est ce
  //    qui distingue le commutateur d'un simple play.
  //  - vers l'edition, on met simplement en PAUSE. L'image revelee reste a
  //    l'ecran, les cadres reviennent par-dessus, et le moteur garde son etat.
  //    Sortir du visionnage ne doit rien effacer.
  //
  // Rien ne remonte du moteur vers le mode : pas de boucle, et le play/pause de
  // la timeline reste utilisable a cote sans deplacer le commutateur.
  useEffect(() => {
    const store = useUnifiedEngineStore.getState();
    if (!isPreviewMode) {
      store.setIsPlaying(false);
      return;
    }
    const window = panelBoundaries.find((b) => b.panelIdx === activeClipIndex);
    store.setCurrentTime(window ? window.startMs : 0);
    store.setIsPlaying(true);
    // panelBoundaries et activeClipIndex sont lus au moment du basculement, pas
    // suivis : changer de clip ne doit pas relancer une lecture en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreviewMode]);

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

  // Where each clip sits on the global timeline. Derived once from the full
  // chain, so a clip's window is the same number the ruler and the narration
  // already use.
  const panelBoundaries = useMemo(() => {
    if (allAnnotations.length === 0) return [];
    const result: { panelIdx: number; startMs: number; endMs: number }[] = [];
    deriveTimeline(allAnnotations).annotations.forEach((ann) => {
      const panelIdx = Number(ann.id.match(/^p(\d+)-/)?.[1]);
      if (Number.isNaN(panelIdx)) return;
      const last = result[result.length - 1];
      if (last && last.panelIdx === panelIdx) last.endMs = ann.reveal.to;
      else
        result.push({
          panelIdx,
          startMs: ann.reveal.from,
          endMs: ann.reveal.to,
        });
    });
    return result;
  }, [allAnnotations]);

  // Les frontieres, enrichies de la transition de sortie de chaque panneau.
  const clipWindows = useMemo(
    () =>
      panelBoundaries.map((b) => ({
        startMs: b.startMs,
        endMs: b.endMs,
        transition: storyboardPanels[b.panelIdx]?.transition,
      })),
    [panelBoundaries, storyboardPanels],
  );

  // Enable canvas rendering.
  const { isOverlayHidden, isScrubbing } = useWhiteboardRenderer({
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
    // Global offset of the active clip on the shared narration clock. The
    // engine always receives 0-based annotations; the renderer translates.
    clipOffsetMs: panelBoundaries.find((b) => b.panelIdx === activeClipIndex)?.startMs ?? 0,
    clips: clipWindows,
  });

  // Lu dans un effet declenche par le clip actif, pas par le scrub : une valeur
  // en dependance le ferait courir apres l'etat au lieu de le consulter.
  const isScrubbingRef = useRef(isScrubbing);
  isScrubbingRef.current = isScrubbing;


  // ── Engine store = active panel, 0-based local annotations ──────────────
  const activePanelAnnotations = useMemo(
    () => toEngineAnnotations(activePanel?.annotations || []),
    // panelBoundaries is intentionally excluded: the annotations themselves
    // are local and do not depend on where the clip sits on the global ruler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeClipIndex, storyboardPanels],
  );

  useEffect(() => {
    useUnifiedEngineStore.getState().setAnnotations(activePanelAnnotations);
  }, [activePanelAnnotations]);

  // ── Sync engine annotation edits back to persistent storyboard store ──────
  useEffect(() => {
    let lastAnns = useUnifiedEngineStore.getState().animation.annotations;
    return useUnifiedEngineStore.subscribe((state) => {
      const anns = state.animation.annotations;
      if (anns === lastAnns) return;
      lastAnns = anns;

      const storyboard = useStoryboardStore.getState();
      const currentPanel = storyboard.storyboardPanels[storyboard.activeClipIndex];
      if (currentPanel) {
        const storedAnns = toStoredAnnotations(anns);
        if (JSON.stringify(currentPanel.annotations) !== JSON.stringify(storedAnns)) {
          storyboard.updatePanel(currentPanel.id, { annotations: storedAnns });
        }
      }
    });
  }, []);

  // ── Follow the clock into the next clip ───────────────────────────────────
  // Only the displayed clip changes; the clock and the narration carry on.
  //
  // Subscribed to rather than selected: the clock ticks every frame, and
  // reading it as state re-rendered this whole editor — canvas, timeline,
  // annotation list, config panel and clip rail — sixty times a second, to
  // change a clip index roughly once every twelve seconds.
  useEffect(() => {
    if (panelBoundaries.length === 0) return;
    let lastTime = -1;
    return useUnifiedEngineStore.subscribe((state) => {
      // The subscription fires on ANY change to the engine store, and picking
      // a clip writes its annotations there. `lastTime` prevents redundant updates
      // when other store properties change.
      const t = state.timeline.currentTime;
      if (t === lastTime) return;
      lastTime = t;

      const playing = panelBoundaries.find(
        (b) => t >= b.startMs && t < b.endMs,
      );
      if (!playing) return;
      const storyboard = useStoryboardStore.getState();
      if (playing.panelIdx !== storyboard.activeClipIndex) {
        storyboard.setActiveClipIndex(playing.panelIdx);
      }
    });
  }, [panelBoundaries]);

  // ── Picking a clip moves the playhead onto it ─────────────────────────────
  // The ruler spans the whole sequence, so a clip is a window on it. Selecting
  // one without seeking left the playhead wherever it was, editing a clip the
  // timeline was not pointing at. Skipped while playing: there the clip
  // follows the clock, not the other way round.
  //
  // Skipped while scrubbing for the same reason: crossing a clip boundary
  // changes the active clip, which fired this effect and snapped the playhead
  // back to that clip's start — the cursor jumped to the beginning of the clip
  // under the hand dragging it, most visibly when rewinding.
  const selectedClipRef = useRef(activeClipIndex);
  useEffect(() => {
    if (selectedClipRef.current === activeClipIndex) return;
    selectedClipRef.current = activeClipIndex;
    if (isScrubbingRef.current) return;
    if (useUnifiedEngineStore.getState().timeline.isPlaying) return;
    const window = panelBoundaries.find((b) => b.panelIdx === activeClipIndex);
    if (window) setCurrentTime(window.startMs);
  }, [activeClipIndex, panelBoundaries, setCurrentTime]);

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
  const resetAnimation = useCallback(() => {
    setCurrentTime(0);
  }, [setCurrentTime]);

  // Stable identity: as an inline closure this was rebuilt on every render of
  // the editor, which re-rendered the settings panel on every clip handover —
  // the single most expensive subtree here, for settings that had not moved.
  const handleConfigChange = useCallback(
    (updates: Partial<WhiteboardConfig>) => {
      // Le store pour la persistance, le moteur pour le rendu.
      onConfigChange(updates);
      if (updates.animStyle) setAnimStyle(updates.animStyle);
      if (updates.handStyle) setHandStyle(updates.handStyle);
      if (updates.revealSpeed !== undefined) setRevealSpeed(updates.revealSpeed);
      if (updates.handSpeed !== undefined) setHandSpeed(updates.handSpeed);
      if (updates.chunks !== undefined) setChunks(updates.chunks);
    },
    // Zustand setters are stable; only the parent callback can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onConfigChange],
  );

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
            className="absolute inset-0 w-full h-full object-contain z-10"
          />
          <canvas
            ref={handCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
          />
          {/* Calque d'edition des annotations. Il masque le dessin qu'on est
              venu regarder : il s'efface donc pendant la lecture et revient a
              l'arret, fin de lecture comprise — d'ou isOverlayHidden, que
              use-whiteboard-renderer calcule en sachant aussi quand on scrube. */}

            <AnnotationOverlay
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              hidden={isOverlayHidden || isPreviewMode}
            />

        </div>


        {/* Annotation timeline, with the narration lane below it. The playhead
            is drawn by the timeline itself, so the lane has to borrow the same
            scale and scroll offset to stay under it. */}
        <div className="relative">
          <AnnotationTimeline onViewportChange={setTimelineViewport} globalAnnotations={allAnnotations} />
          <AudioTrackRow viewport={timelineViewport} />
          <TimelinePlayhead viewport={timelineViewport} />
        </div>

        {/* Play/pause lives in the timeline toolbar; only reset is extra. */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetAnimation}
            className="flex gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Label
              htmlFor="annotation-preview-mode"
              className="cursor-pointer text-xs text-muted-foreground"
            >
              {isPreviewMode ? "Aperçu" : "Édition"}
            </Label>
            <Switch
              id="annotation-preview-mode"
              checked={isPreviewMode}
              onCheckedChange={setIsPreviewMode}
              aria-label="Basculer entre édition et aperçu des annotations"
            />
          </div>
        </div>
      </div>

      {/* Right: reglages, puis la sequence d'annotations. C'est cette liste qui
          justifie le rail : elle a besoin de toute la hauteur disponible, la ou
          deux controles seuls ne la remplissaient pas. */}
      <div className="w-72 shrink-0 min-h-0 flex flex-col gap-3">
        <WhiteboardConfigPanel
          config={config}
          onChange={handleConfigChange}
        />

        <ClipTransitionPicker />

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
