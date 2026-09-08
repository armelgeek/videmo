"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { WhiteboardConfigPanel } from "./whiteboard-config-panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useUnifiedEngine } from "@/lib/unified-engine/hooks/useUnifiedEngine";
import * as selectors from "@/lib/unified-engine/hooks/selectors";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { toEngineAnnotations, toStoredAnnotations } from "../timeline/annotation-interop";
import { useWhiteboardRenderer } from "../hooks/use-whiteboard-renderer";
import { deriveTimeline } from "../timeline/derive-timeline";
import { AnnotationTimeline } from "../timeline/annotation-timeline";
import { panelWindows, type DrawnSpan } from "../timeline/panel-windows";
import {
  annotationPleineImage,
  PLEINE_IMAGE_ID,
} from "../timeline/panel-fallback-annotation";
import { AnnotationListPanel } from "./annotation-list-panel";
import { AudioTrackRow } from "./audio-track-row";
import { TimelinePlayhead } from "./timeline-playhead";
import { ClipTransitionMarkers } from "./clip-transition-markers";
import type { WhiteboardConfig } from "@/lib/storyboard/store";
import { useStoryboardStore } from "@/lib/storyboard/store";
import { narrationEndMs } from '../audio/narration-schedule';
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

  // Le meme echec (piste introuvable, moteur qui refuse de demarrer) peut
  // ressortir a chaque frame tant que la cause persiste : sans ce garde, un
  // seul probleme inondait l'ecran de toasts identiques.
  const derniereErreurRef = useRef<string | null>(null);
  const signalerErreurRendu = useCallback((message: string) => {
    if (derniereErreurRef.current === message) return;
    derniereErreurRef.current = message;
    toast.error(message);
  }, []);

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

  // Connect to unified engine — selecteur ETROIT, delibere : `currentTime` et
  // tout ce qui en derive (`progress`) changent 60 fois par seconde pendant
  // la lecture. Rien ici n'en a besoin (la boucle de rendu lit l'horloge
  // directement dans le store, voir use-whiteboard-renderer.ts), et les
  // inclure re-rendait tout cet arbre — canvas, sidebar, timeline, liste
  // d'annotations, panneau de config — a 60Hz durant toute lecture.
  const {
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
  } = useUnifiedEngine<{
    animStyle: string;
    setAnimStyle: (v: string) => void;
    handStyle: string;
    setHandStyle: (v: string) => void;
    revealSpeed: number;
    setRevealSpeed: (v: number | undefined) => void;
    handSpeed: number;
    setHandSpeed: (v: number | undefined) => void;
    chunks: number;
    setChunks: (v: number | undefined) => void;
    setCanvasBg: (v: string) => void;
    annotations: ReturnType<typeof selectors.selectAnnotations>;
    setCurrentTime: (v: number) => void;
  }>((state) => ({
    animStyle: selectors.selectAnimStyle(state),
    setAnimStyle: state.setAnimStyle,
    handStyle: selectors.selectHandStyle(state),
    setHandStyle: state.setHandStyle,
    revealSpeed: selectors.selectRevealSpeed(state),
    setRevealSpeed: state.setRevealSpeed,
    handSpeed: selectors.selectHandSpeed(state),
    setHandSpeed: state.setHandSpeed,
    chunks: selectors.selectChunks(state),
    setChunks: state.setChunks,
    setCanvasBg: state.setCanvasBg,
    annotations: selectors.selectAnnotations(state),
    setCurrentTime: state.setCurrentTime,
  }));

  /**
   * Les annotations d'une image, avec son repli plein cadre si elle n'en a
   * aucune. C'est la SEULE lecture des annotations d'un panneau : la piste, le
   * canvas et le moteur doivent voir la meme chose, sinon le clip existe sur la
   * timeline sans cadre a l'ecran.
   */
  const annotationsDe = useCallback(
    (panel: (typeof storyboardPanels)[number] | undefined) => {
      const stockees = toEngineAnnotations(panel?.annotations || []);
      if (stockees.length > 0 || !panel) return stockees;
      return [
        annotationPleineImage(panel, {
          width: canvasWidth,
          height: canvasHeight,
        }),
      ];
    },
    [canvasWidth, canvasHeight],
  );

  /**
   * Le repli devient une vraie annotation du projet, sur TOUTES les images.
   *
   * Sans cela il n'existait qu'a l'affichage, et seule l'image ouverte finissait
   * par l'enregistrer en passant par le store moteur : les autres gardaient zero
   * annotation en base, donc rien a dessiner au rendu. L'ecriture retombe a plat
   * des le passage suivant — une image qui en a une n'est plus touchee.
   */
  useEffect(() => {
    const store = useStoryboardStore.getState();
    // Une seule ecriture groupee, pas un updatePanel par image : chacun
    // recopiait tout le tableau (immutabilite), donc N images sans annotation
    // valaient N copies sequentielles du tableau entier — O(n²) — plus N
    // notifications aux abonnes (autosave inclus) au lieu d'une seule.
    let touche = false;
    const panels = store.storyboardPanels.map((panel) => {
      if ((panel.annotations?.length ?? 0) > 0) return panel;
      touche = true;
      return {
        ...panel,
        annotations: toStoredAnnotations([
          annotationPleineImage(panel, {
            width: canvasWidth,
            height: canvasHeight,
          }),
        ]),
      };
    });
    if (touche) store.setStoryboardPanels(panels);
  }, [storyboardPanels, canvasWidth, canvasHeight]);

  // ── Global timeline sequence ─────────────────────────────────────────────
  // All panels' annotations chained end-to-end for the timeline display.
  // Each id is prefixed with its panel index to stay unique across panels.
  // Assure un blanc par defaut (300ms) pour les panneaux secondaires afin
  // de reserver l'espace necessaire a l'affichage de la carte de transition.
  const allAnnotations = useMemo(() => {
    return storyboardPanels.flatMap((panel, panelIdx) => {
      // Une image sans annotation garde un clip : toute l'image devient une
      // zone, sur la duree de sa voix. Voir panel-fallback-annotation.ts.
      const anns = annotationsDe(panel);
      return anns.map((a, aIdx) => {
        let gapBeforeMs = a.reveal.gapBeforeMs ?? 0;
        // Le blanc par defaut est refuse a l'image entiere : sa duree EST celle
        // de sa voix, donc tout blanc pose devant decale le reste de la piste
        // sans decaler la narration, qui s'enchaine sans trou. Le decalage
        // s'accumulait d'une image a la suivante et la voix, tiree sur le
        // dessin a chaque frame, sautait 300 ms de plus a chaque bascule.
        const pleineImage = a.id === PLEINE_IMAGE_ID;
        if (panelIdx > 0 && aIdx === 0 && gapBeforeMs === 0 && !pleineImage) {
          gapBeforeMs = 300;
        }
        return {
          ...a,
          id: `p${panelIdx}-${a.id}`,
          reveal: {
            ...a.reveal,
            gapBeforeMs,
          },
        };
      });
    });
  }, [storyboardPanels, annotationsDe]);

  // Where each clip sits on the global timeline.
  // Panel i > 0 starts where Panel i-1 ends, so that the gap before Panel i
  // is included in Panel i's boundary (clipOffsetMs).
  //
  // Toutes les images en recoivent une, y compris celles qui ne dessinent
  // rien : leur absence faisait retomber `clipOffsetMs` sur son `?? 0`, et la
  // narration repartait du debut en basculant sur elles. Voir panel-windows.ts.
  const panelBoundaries = useMemo(() => {
    const drawingSpans: DrawnSpan[] = [];
    deriveTimeline(allAnnotations).annotations.forEach((ann) => {
      const panelIdx = Number(ann.id.match(/^p(\d+)-/)?.[1]);
      if (Number.isNaN(panelIdx)) return;
      const last = drawingSpans[drawingSpans.length - 1];
      if (last && last.panelIdx === panelIdx) {
        last.drawEndMs = ann.reveal.to;
      } else {
        drawingSpans.push({
          panelIdx,
          drawStartMs: ann.reveal.from,
          drawEndMs: ann.reveal.to,
        });
      }
    });

    return panelWindows(storyboardPanels, drawingSpans);
  }, [allAnnotations, storyboardPanels]);

  // Les frontieres de clips pour le moteur de transition et les marqueurs.
  // sortant.endMs est la fin du dessin du panneau sortant,
  // entrant.startMs est le debut du dessin du panneau entrant.
  const clipWindows = useMemo(
    () =>
      panelBoundaries.map((b, idx) => {
        const next = panelBoundaries[idx + 1];
        const blanc = next ? Math.max(0, next.drawStartMs - b.drawEndMs) : 0;
        let transition = storyboardPanels[b.panelIdx]?.transition;

        if (blanc > 0 && transition && transition.type !== "none") {
          transition = {
            ...transition,
            durationMs: blanc,
          };
        } else {
          transition = transition ?? { type: "none", durationMs: blanc };
        }

        return {
          startMs: b.drawStartMs,
          endMs: b.drawEndMs,
          transition,
          panelId: storyboardPanels[b.panelIdx]?.id,
        };
      }),
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
    // La voix par temps prime sur la piste unique : c'est elle que la chaine
    // produit, et elle n'a pas a etre reconcatenee quand un temps change.
    narrationParts: config.narration ?? [],
    audioVolume: config.audio?.volume ?? 1,
    audioMuted: config.audio?.muted ?? false,
    audioDurationMs: config.narration?.length
      ? narrationEndMs(config.narration)
      : config.audio?.durationMs ?? null,
    savedAnnotations: activePanel
      ? annotationsDe(activePanel)
      : config.annotations
        ? toEngineAnnotations(config.annotations)
        : null,
    // Global offset of the active clip on the shared narration clock. The
    // engine always receives 0-based annotations; the renderer translates.
    // L'origine du clip pour le moteur est le debut de son TRACE, pas celui du
    // panneau : c'est ce que `clipWindows` publie deja (startMs: drawStartMs),
    // et c'est ce a quoi la sequence locale, ramenee a zero, se rapporte.
    // Prendre `startMs` decalait le dessin de toute l'attente initiale.
    clipOffsetMs:
      panelBoundaries.find((b) => b.panelIdx === activeClipIndex)?.drawStartMs ?? 0,
    clips: clipWindows,
    onError: signalerErreurRendu,
  });

  // Lu dans un effet declenche par le clip actif, pas par le scrub : une valeur
  // en dependance le ferait courir apres l'etat au lieu de le consulter.
  const isScrubbingRef = useRef(isScrubbing);
  isScrubbingRef.current = isScrubbing;


  // ── Engine store = active panel, 0-based local annotations ──────────────
  const activePanelAnnotations = useMemo(
    () => annotationsDe(activePanel),
    // panelBoundaries is intentionally excluded: the annotations themselves
    // are local and do not depend on where the clip sits on the global ruler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeClipIndex, storyboardPanels, annotationsDe],
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
          <AnnotationTimeline
            onViewportChange={setTimelineViewport}
            globalAnnotations={allAnnotations}
            clipWindows={clipWindows}
            onTransitionResize={(panelIdx, durationMs) => {
              const sortantPanel = storyboardPanels[panelIdx];
              const entrantPanel = storyboardPanels[panelIdx + 1];
              if (!sortantPanel?.transition) return;

              const newDuration = Math.max(50, durationMs);
              useStoryboardStore.getState().updatePanel(sortantPanel.id, {
                transition: { ...sortantPanel.transition, durationMs: newDuration },
              });

              if (entrantPanel) {
                const sortantWindow = clipWindows[panelIdx];
                const entrantWindow = clipWindows[panelIdx + 1];
                const currentBlanc =
                  entrantWindow && sortantWindow
                    ? entrantWindow.startMs - sortantWindow.endMs
                    : 0;

                const deltaNeeded = newDuration - currentBlanc;
                if (deltaNeeded !== 0) {
                  const anns = annotationsDe(entrantPanel);
                  if (anns.length > 0) {
                    const currentGap = anns[0].reveal.gapBeforeMs ?? 0;
                    const newGap = Math.max(50, currentGap + deltaNeeded);
                    anns[0] = {
                      ...anns[0],
                      reveal: {
                        ...anns[0].reveal,
                        gapBeforeMs: newGap,
                      },
                    };
                    const updatedStored = toStoredAnnotations(anns);
                    useStoryboardStore.getState().updatePanel(entrantPanel.id, {
                      annotations: updatedStored,
                    });

                    if (panelIdx + 1 === useStoryboardStore.getState().activeClipIndex) {
                      useUnifiedEngineStore.getState().setAnnotations(anns);
                    }
                  }
                }
              }
            }}
            onTransitionTypeChange={(panelIdx, newType) => {
              const sortantPanel = storyboardPanels[panelIdx];
              const entrantPanel = storyboardPanels[panelIdx + 1];
              if (!sortantPanel) return;

              const currentDuration = sortantPanel.transition?.durationMs ?? 300;
              useStoryboardStore.getState().updatePanel(sortantPanel.id, {
                transition: {
                  type: newType as any,
                  durationMs: currentDuration,
                },
              });

              if (newType !== "none" && entrantPanel) {
                const sortantWindow = clipWindows[panelIdx];
                const entrantWindow = clipWindows[panelIdx + 1];
                const currentBlanc =
                  entrantWindow && sortantWindow
                    ? entrantWindow.startMs - sortantWindow.endMs
                    : 0;

                if (currentBlanc === 0) {
                  const anns = annotationsDe(entrantPanel);
                  if (anns.length > 0) {
                    const currentGap = anns[0].reveal.gapBeforeMs ?? 0;
                    anns[0] = {
                      ...anns[0],
                      reveal: {
                        ...anns[0].reveal,
                        gapBeforeMs: currentGap + 300,
                      },
                    };
                    const updatedStored = toStoredAnnotations(anns);
                    useStoryboardStore.getState().updatePanel(entrantPanel.id, {
                      annotations: updatedStored,
                    });

                    if (panelIdx + 1 === useStoryboardStore.getState().activeClipIndex) {
                      useUnifiedEngineStore.getState().setAnnotations(anns);
                    }
                  }
                }
              }
            }}
          />
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

        <ClipTransitionPicker clips={clipWindows} />

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
