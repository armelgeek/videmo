"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { DEFAULT_ANIM_STYLE } from "../schema";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUnifiedEngine } from "@/lib/unified-engine/hooks/useUnifiedEngine";
import * as selectors from "@/lib/unified-engine/hooks/selectors";
import { selectSceneAnnotations } from "@/lib/unified-engine/hooks/selectors";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import {
  annotationsEqual,
  toEngineAnnotations,
  toStoredAnnotations,
} from "../timeline/annotation-interop";
import { useWhiteboardRenderer } from "../hooks/use-whiteboard-renderer";
import { deriveTimeline } from "../timeline/derive-timeline";
import { AnnotationTimeline } from "../timeline/annotation-timeline";
import { panelWindows, type DrawnSpan } from "../timeline/panel-windows";
import {
  annotationPleineImage,
  PLEINE_IMAGE_ID,
} from "../timeline/panel-fallback-annotation";
import { AnnotationListPanel } from "./annotation-list-panel";
import { SceneDetailsPanel } from "./scene-details-panel";
import { ScriptSegmentsCard } from "./script-segments-card";
import { TimelinePlayhead } from "./timeline-playhead";
import { ClipTransitionMarkers } from "./clip-transition-markers";
import type { WhiteboardConfig } from "@/lib/storyboard/store";
import { useStoryboardStore } from "@/lib/storyboard/store";
import { narrationEndMs } from "../audio/narration-schedule";
import { DEMO_STORYBOARD } from "@/lib/demo-data";
import { tailleCanvas, cssAspectRatio, type RatioProjet } from "../canvas-size";
import { ClipSelectorBar } from "./clip-selector-bar";

/** Konva touche `window` des son chargement : pas d'evaluation au rendu serveur. */
const AnnotationOverlay = dynamic(
  () => import("./annotation-overlay").then((m) => m.AnnotationOverlay),
  { ssr: false },
);

function AnnotationCountBadge() {
  const count = useUnifiedEngineStore(
    (s) => selectSceneAnnotations(s).length,
  );
  return (
    <span className="rounded-full bg-background px-1.5 text-[10px] tabular-nums text-muted-foreground">
      {count}
    </span>
  );
}

interface WhiteboardEditorStepProps {
  config: WhiteboardConfig;
  /** Ratio du PROJET (projectParams), seule source pour la forme du canvas. */
  aspectRatio: RatioProjet;
  onConfigChange: (config: Partial<WhiteboardConfig>) => void;
}

export function WhiteboardEditorStep({
  config,
  aspectRatio,
  onConfigChange,
}: WhiteboardEditorStepProps) {
  // Shared so the narration lane lines up with the timeline ruler above it.
  const [timelineViewport, setTimelineViewport] = useState<
    | { scrollEl: HTMLElement | null; contentWidth: number; zoomLevel: number }
    | undefined
  >(undefined);
  const [sideTab, setSideTab] = useState<"scene" | "annotations">("scene");
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
  // De meme, le compte d'annotations est isole dans AnnotationCountBadge
  // pour eviter de re-rendre tout l'editeur a chaque bascule de scene.
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
  //
  // Un cache ref stabilise les références par panel : tant que les annotations
  // et l'index d'un panel ne bougent pas, ses objets sont réutilisés verbatim,
  // et si aucun panel n'a changé le tableau global conserve son identité.
  const panelAnnotationsCacheRef = useRef<
    Map<
      string,
      {
        panel: (typeof storyboardPanels)[number];
        panelIdx: number;
        canvasWidth: number;
        canvasHeight: number;
        result: ReturnType<typeof annotationsDe>;
      }
    >
  >(new Map());
  const prevAllAnnotationsRef = useRef<ReturnType<typeof annotationsDe>>([]);

  const allAnnotations = useMemo(() => {
    let anyChanged = false;
    const cache = panelAnnotationsCacheRef.current;
    const newResults: ReturnType<typeof annotationsDe>[] = [];

    storyboardPanels.forEach((panel, panelIdx) => {
      const cached = cache.get(panel.id);
      if (
        cached &&
        cached.panel === panel &&
        cached.panelIdx === panelIdx &&
        cached.canvasWidth === canvasWidth &&
        cached.canvasHeight === canvasHeight
      ) {
        newResults.push(cached.result);
        return;
      }

      anyChanged = true;
      const anns = annotationsDe(panel);
      const transformed = anns.map((a) => {
        const gapBeforeMs = a.reveal.gapBeforeMs ?? 0;
        return {
          ...a,
          id: `p${panelIdx}-${a.id}`,
          reveal: {
            ...a.reveal,
            gapBeforeMs,
          },
        };
      });

      cache.set(panel.id, {
        panel,
        panelIdx,
        canvasWidth,
        canvasHeight,
        result: transformed,
      });
      newResults.push(transformed);
    });

    if (cache.size > storyboardPanels.length) {
      const currentIds = new Set(storyboardPanels.map((p) => p.id));
      for (const id of cache.keys()) {
        if (!currentIds.has(id)) cache.delete(id);
      }
    }

    if (
      !anyChanged &&
      prevAllAnnotationsRef.current.length > 0 &&
      newResults.length === storyboardPanels.length
    ) {
      return prevAllAnnotationsRef.current;
    }

    const flattened = newResults.flat();
    prevAllAnnotationsRef.current = flattened;
    return flattened;
  }, [storyboardPanels, annotationsDe, canvasWidth, canvasHeight]);

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

  // Une scene deja preparee arrive en quelques ms : l'indicateur n'apparait
  // qu'au-dela, sinon il clignoterait a chaque bascule.
  // En passant par un callback au lieu d'un state retourné par le renderer,
  // on évite 2 re-renders complets de l'éditeur lors de chaque bascule rapide (<150ms).
  const [showPreparing, setShowPreparing] = useState(false);
  const prepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleArtworkPendingChange = useCallback((pending: boolean) => {
    if (prepTimerRef.current) {
      clearTimeout(prepTimerRef.current);
      prepTimerRef.current = null;
    }
    if (!pending) {
      setShowPreparing(false);
    } else {
      prepTimerRef.current = setTimeout(() => {
        setShowPreparing(true);
      }, 150);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (prepTimerRef.current) clearTimeout(prepTimerRef.current);
    };
  }, []);

  // Préchargement proactif de toutes les images du storyboard, en priorisant
  // la scène suivante puis le reste des scènes pour éviter les freezes lors des sauts.
  const upcomingImageUrls = useMemo(() => {
    const nextIdx = activeClipIndex + 1;
    const urls: string[] = [];
    // Priorité 1 : scène N+1
    const nextUrl =
      storyboardPanels[nextIdx]?.imageUrl ||
      DEMO_STORYBOARD.panels[nextIdx % DEMO_STORYBOARD.panels.length]?.imageUrl;
    if (nextUrl) urls.push(nextUrl);

    // Priorité 2 : scène N+2
    const n2Url =
      storyboardPanels[nextIdx + 1]?.imageUrl ||
      DEMO_STORYBOARD.panels[(nextIdx + 1) % DEMO_STORYBOARD.panels.length]?.imageUrl;
    if (n2Url && !urls.includes(n2Url)) urls.push(n2Url);

    // Priorité 3 : reste des scènes du storyboard
    storyboardPanels.forEach((p, idx) => {
      const url = p.imageUrl || DEMO_STORYBOARD.panels[idx % DEMO_STORYBOARD.panels.length]?.imageUrl;
      if (url && !urls.includes(url)) urls.push(url);
    });

    return urls;
  }, [storyboardPanels, activeClipIndex]);

  const activeSavedAnnotations = useMemo(() => {
    if (activePanel) return annotationsDe(activePanel);
    if (config.annotations) return toEngineAnnotations(config.annotations);
    return null;
  }, [activePanel, annotationsDe, config.annotations]);

  // Enable canvas rendering.
  const { isOverlayHidden, isScrubbing } =
    useWhiteboardRenderer({
      canvasRef,
      canvasWidth,
      canvasHeight,
      handCanvasRef,
      imageUrl:
        activePanel?.imageUrl ||
        DEMO_STORYBOARD.panels[activeClipIndex % DEMO_STORYBOARD.panels.length]
          ?.imageUrl,
      nextImageUrl:
        storyboardPanels[activeClipIndex + 1]?.imageUrl ||
        DEMO_STORYBOARD.panels[(activeClipIndex + 1) % DEMO_STORYBOARD.panels.length]
          ?.imageUrl ||
        null,
      upcomingImageUrls,
      scenePanelId: activePanel?.id ?? null,
      audioUrl: config.audio?.url ?? null,
      // La voix par temps prime sur la piste unique : c'est elle que la chaine
      // produit, et elle n'a pas a etre reconcatenee quand un temps change.
      narrationParts: config.narration ?? [],
      audioVolume: config.audio?.volume ?? 1,
      audioMuted: config.audio?.muted ?? false,
      audioDurationMs: config.narration?.length
        ? narrationEndMs(config.narration)
        : (config.audio?.durationMs ?? null),
      savedAnnotations: activeSavedAnnotations,
      // Global offset of the active clip on the shared narration clock. The
      // engine always receives 0-based annotations; the renderer translates.
      // L'origine du clip pour le moteur est le debut de son TRACE, pas celui du
      // panneau : c'est ce que `clipWindows` publie deja (startMs: drawStartMs),
      // et c'est ce a quoi la sequence locale, ramenee a zero, se rapporte.
      // Prendre `startMs` decalait le dessin de toute l'attente initiale.
      clipOffsetMs:
        panelBoundaries.find((b) => b.panelIdx === activeClipIndex)
          ?.drawStartMs ?? 0,
      clips: clipWindows,
      onError: signalerErreurRendu,
      onArtworkPendingChange: handleArtworkPendingChange,
    });

  // Lu dans un effet declenche par le clip actif, pas par le scrub : une valeur
  // en dependance le ferait courir apres l'etat au lieu de le consulter.
  const isScrubbingRef = useRef(isScrubbing);
  isScrubbingRef.current = isScrubbing;

  // ── Engine store = TOUTES les scenes, a plat ─────────────────────────────
  //
  // Charge une seule fois (quand les panneaux changent reellement), pas a
  // chaque bascule de scene : changer de scene active ne touche plus du tout
  // ce tableau, seulement `ui.activeScenePanelId` (voir plus bas), qui ne
  // fait pointer le moteur ailleurs dans les MEMES donnees sans rien
  // recalculer ni republier. C'est ce qui evitait auparavant la reconstruction
  // du moteur de dessin — jusqu'a l'ecriture parasite vers le stockage — a
  // chaque passage d'une scene a l'autre.
  const flatAnnotationsCacheRef = useRef<
    Map<
      string,
      {
        panel: (typeof storyboardPanels)[number];
        result: ReturnType<typeof annotationsDe>;
      }
    >
  >(new Map());
  const prevFlatAnnotationsRef = useRef<ReturnType<typeof annotationsDe>>([]);

  const flatAnnotations = useMemo(() => {
    let anyChanged = false;
    const cache = flatAnnotationsCacheRef.current;
    const newResults: ReturnType<typeof annotationsDe>[] = [];

    storyboardPanels.forEach((panel) => {
      const cached = cache.get(panel.id);
      if (cached && cached.panel === panel) {
        newResults.push(cached.result);
        return;
      }

      anyChanged = true;
      const res = annotationsDe(panel).map((a) => ({
        ...a,
        panelId: panel.id,
      }));
      cache.set(panel.id, { panel, result: res });
      newResults.push(res);
    });

    if (cache.size > storyboardPanels.length) {
      const currentIds = new Set(storyboardPanels.map((p) => p.id));
      for (const id of cache.keys()) {
        if (!currentIds.has(id)) cache.delete(id);
      }
    }

    if (
      !anyChanged &&
      prevFlatAnnotationsRef.current.length > 0 &&
      newResults.length === storyboardPanels.length
    ) {
      return prevFlatAnnotationsRef.current;
    }

    const flattened = newResults.flat();
    prevFlatAnnotationsRef.current = flattened;
    return flattened;
  }, [storyboardPanels, annotationsDe]);

  useEffect(() => {
    const store = useUnifiedEngineStore.getState();
    if (store.animation.annotations === flatAnnotations) return;
    // Filet de securite : un recalcul au contenu identique (storyboardPanels
    // a change pour une raison sans rapport, titre d'une image, etc.) ne doit
    // pas republier — meme raison que pour l'ecriture retour plus bas.
    if (!annotationsEqual(store.animation.annotations, flatAnnotations)) {
      store.setAnnotations(flatAnnotations);
    }
  }, [flatAnnotations]);

  // La scene DESSINEE/EDITEE se deduit de la position de lecture — c'est deja
  // ce que fait activeClipIndex plus bas — et se contente de pointer dans le
  // tableau plat ci-dessus, sans jamais le reecrire.
  useEffect(() => {
    const engine = useUnifiedEngineStore.getState();
    engine.setActiveScenePanelId(activePanel?.id ?? null);
    engine.setSelectedAnnotation(null);
  }, [activePanel?.id]);

  // ── Sync engine annotation edits back to persistent storyboard store ──────
  //
  // Une edition (overlay, liste, timeline) ne touche jamais que la scene
  // active dans le store moteur (voir setSceneAnnotations/updateAnnotation) ;
  // c'est donc sa seule tranche, extraite du tableau plat, qui est comparee
  // et reecrite — jamais les autres scenes.
  useEffect(() => {
    let lastAnns = useUnifiedEngineStore.getState().animation.annotations;
    return useUnifiedEngineStore.subscribe((state) => {
      const anns = state.animation.annotations;
      if (anns === lastAnns) return;
      lastAnns = anns;

      const panelId = state.ui.activeScenePanelId;
      if (panelId === null) return;
      const storyboard = useStoryboardStore.getState();
      const currentPanel = storyboard.storyboardPanels.find((p) => p.id === panelId);
      if (currentPanel) {
        const sceneAnns = anns.filter((a) => a.panelId === panelId);
        const storedAnns = toStoredAnnotations(sceneAnns);
        if (!annotationsEqual(currentPanel.annotations, storedAnns)) {
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
        const targetPanel = storyboard.storyboardPanels[playing.panelIdx];
        if (targetPanel) {
          const engine = useUnifiedEngineStore.getState();
          engine.setActiveScenePanelId(targetPanel.id);
          engine.setSelectedAnnotation(null);
        }
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
    setAnimStyle(DEFAULT_ANIM_STYLE);
    setHandStyle(config.handStyle);
    setRevealSpeed(config.revealSpeed);
    setHandSpeed(config.handSpeed);
    setChunks(config.chunks);
    setCanvasBg("white");
  }, [config]);

  // Stable identity: as an inline closure this was rebuilt on every render of
  // the editor, which re-rendered the settings panel on every clip handover —
  // the single most expensive subtree here, for settings that had not moved.
  const handleConfigChange = useCallback(
    (updates: Partial<WhiteboardConfig>) => {
      // Le store pour la persistance, le moteur pour le rendu.
      onConfigChange(updates);
      if (updates.animStyle) setAnimStyle(updates.animStyle);
      if (updates.handStyle) setHandStyle(updates.handStyle);
      if (updates.revealSpeed !== undefined)
        setRevealSpeed(updates.revealSpeed);
      if (updates.handSpeed !== undefined) setHandSpeed(updates.handSpeed);
      if (updates.chunks !== undefined) setChunks(updates.chunks);
    },
    // Zustand setters are stable; only the parent callback can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onConfigChange],
  );

  const handleTransitionResize = useCallback(
    (panelIdx: number, durationMs: number) => {
      const storyboard = useStoryboardStore.getState();
      const sortantPanel = storyboard.storyboardPanels[panelIdx];
      const entrantPanel = storyboard.storyboardPanels[panelIdx + 1];
      if (!sortantPanel?.transition) return;

      const newDuration = Math.max(50, durationMs);
      storyboard.updatePanel(sortantPanel.id, {
        transition: {
          ...sortantPanel.transition,
          durationMs: newDuration,
        },
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
            storyboard.updatePanel(entrantPanel.id, {
              annotations: updatedStored,
            });
            useUnifiedEngineStore.getState().setSceneAnnotations(entrantPanel.id, anns);
          }
        }
      }
    },
    [clipWindows, annotationsDe],
  );

  const handleTransitionTypeChange = useCallback(
    (panelIdx: number, newType: string) => {
      const storyboard = useStoryboardStore.getState();
      const sortantPanel = storyboard.storyboardPanels[panelIdx];
      const entrantPanel = storyboard.storyboardPanels[panelIdx + 1];
      if (!sortantPanel) return;

      const currentDuration =
        sortantPanel.transition?.durationMs ?? 300;
      storyboard.updatePanel(sortantPanel.id, {
        transition: {
          type: newType as any,
          durationMs: currentDuration,
        },
      });

      if (newType === "none" && entrantPanel) {
        const anns = annotationsDe(entrantPanel);
        if (anns.length > 0 && (anns[0].reveal.gapBeforeMs ?? 0) > 0) {
          anns[0] = {
            ...anns[0],
            reveal: {
              ...anns[0].reveal,
              gapBeforeMs: 0,
            },
          };
          const updatedStored = toStoredAnnotations(anns);
          storyboard.updatePanel(entrantPanel.id, {
            annotations: updatedStored,
          });
          useUnifiedEngineStore.getState().setSceneAnnotations(entrantPanel.id, anns);
        }
      } else if (newType !== "none" && entrantPanel) {
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
            storyboard.updatePanel(entrantPanel.id, {
              annotations: updatedStored,
            });
            useUnifiedEngineStore.getState().setSceneAnnotations(entrantPanel.id, anns);
          }
        }
      }
    },
    [clipWindows, annotationsDe],
  );

  return (
    <div className="w-full h-full flex gap-4 overflow-hidden px-8 py-4 sm:px-12">
      {/* Column 1: Vertical Clip Selector Sidebar */}
      <ClipSelectorBar />

      {/* Column 2: Canvas Preview & Annotation Timeline */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 overflow-hidden">
        {/* Canvas Container */}
        {/* Le canevas prend toute la hauteur laissee par la timeline, au format
            du projet : sa taille se deduit de la place, pas d'une hauteur figee. */}
        <div className="flex-1 min-h-0 rounded-lg border-2 border-border bg-card/50 p-6">
          <div className="h-full w-full flex items-center justify-center [container-type:size]">
            <div
              className="rounded-lg bg-white overflow-hidden relative shadow-[3px_3px_0_hsl(var(--offset))] border-2 border-ink"
              style={{
                aspectRatio: cssAspectRatio(aspectRatio),
                width: `min(100cqw, calc(100cqh * ${canvasWidth} / ${canvasHeight}))`,
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
              {showPreparing && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 z-30 flex items-center justify-center bg-background/30 pointer-events-none"
                >
                  <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    Préparation de la scène…
                  </div>
                </div>
              )}
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
          </div>
        </div>

        {/* Annotation timeline, with the narration lane below it. The playhead
            is drawn by the timeline itself, so the lane has to borrow the same
            scale and scroll offset to stay under it. */}
        <ScriptSegmentsCard
          sceneStartMs={
            panelBoundaries.find((b) => b.panelIdx === activeClipIndex)
              ?.startMs ?? 0
          }
        />

        <div className="relative shrink-0 rounded-lg border-2 border-border bg-card overflow-hidden shadow-[3px_3px_0_hsl(var(--offset))]">
          <AnnotationTimeline
            onViewportChange={setTimelineViewport}
            globalAnnotations={allAnnotations}
            clipWindows={clipWindows}
            onTransitionResize={handleTransitionResize}
            onTransitionTypeChange={handleTransitionTypeChange}
          />
          <TimelinePlayhead viewport={timelineViewport} />
        </div>
      </div>

      {/* Right: reglages, puis la sequence d'annotations. C'est cette liste qui
          justifie le rail : elle a besoin de toute la hauteur disponible, la ou
          deux controles seuls ne la remplissaient pas. */}
      <div className="w-80 shrink-0 min-h-0 flex flex-col gap-3">
        <div
          role="tablist"
          aria-label="Side panel"
          className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border-2 border-border bg-card p-2"
        >
          {(["scene", "annotations"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={sideTab === tab}
              onClick={() => setSideTab(tab)}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                sideTab === tab
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "scene" ? "Scene" : "Annotations"}
              {tab === "annotations" && <AnnotationCountBadge />}
            </button>
          ))}
        </div>

        {sideTab === "scene" ? (
          <SceneDetailsPanel className="flex-1 min-h-0 overflow-y-auto" />
        ) : (
          <AnnotationListPanel
            className="flex-1"
            sceneOffsetMs={
              panelBoundaries.find((b) => b.panelIdx === activeClipIndex)
                ?.drawStartMs ?? 0
            }
          />
        )}
      </div>
    </div>
  );
}
