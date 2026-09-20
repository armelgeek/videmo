"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { DEFAULT_ANIM_STYLE } from "../schema";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Play } from "lucide-react";
import { Hint } from "@/components/molecules/hint";
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
import { canvasSize, cssAspectRatio, type RatioProjet } from "../canvas-size";
import { ClipSelectorBar } from "./clip-selector-bar";

/** Konva touches `window` as soon as it loads: no evaluation during server rendering. */
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
  /** PROJECT ratio (projectParams), sole source for the canvas shape. */
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
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const switchMode = (next: "edit" | "preview") => {
    if (next === "edit") {
      const engine = useUnifiedEngineStore.getState();
      if (engine.timeline.isPlaying) engine.setIsPlaying(false);
    }
    setMode(next);
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);

  // The same failure (track not found, engine refusing to start) can
  // resurface every frame while the cause persists: without this guard, a
  // single problem flooded the screen with identical toasts.
  const lastErrorRef = useRef<string | null>(null);
  const reportRenderError = useCallback((message: string) => {
    if (lastErrorRef.current === message) return;
    lastErrorRef.current = message;
    toast.error(message);
  }, []);

  const { width: canvasWidth, height: canvasHeight } =
    canvasSize(aspectRatio);

  const storyboardPanels = useStoryboardStore((s) => s.storyboardPanels);
  const activeClipIndex = useStoryboardStore((s) => s.activeClipIndex);

  const activePanel = storyboardPanels[activeClipIndex] || storyboardPanels[0];

  // Connect to unified engine — NARROW selector, on purpose: `currentTime` and
  // everything derived from it (`progress`) change 60 times a second during
  // playback. Nothing here needs them (the render loop reads the clock
  // directly from the store, see use-whiteboard-renderer.ts), and including
  // them re-rendered this whole tree — canvas, sidebar, timeline, annotation
  // list, config panel — at 60Hz throughout playback.
  // Likewise, the annotation count is isolated in AnnotationCountBadge
  // to avoid re-rendering the whole editor on every scene switch.
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
    * An image's annotations, with its full-frame fallback if it has none.
    * This is the ONLY read of a panel's annotations: the track, the canvas and
    * the engine must see the same thing, otherwise the clip exists on the
    * timeline with no frame on screen.
   */
  const annotationsOf = useCallback(
    (panel: (typeof storyboardPanels)[number] | undefined) => {
      const stored = toEngineAnnotations(panel?.annotations || []);
      if (stored.length > 0 || !panel) return stored;
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
    * The fallback becomes a real project annotation, on ALL images.
    *
    * Without this it only existed on display, and only the open image ended up
    * saving it through the engine store: the others kept zero annotations in
    * the database, so nothing to draw at render time. The write falls flat
    * from the next pass on — an image that already has one is not touched.
   */
  useEffect(() => {
    const store = useStoryboardStore.getState();
    // A single batched write, not one updatePanel per image: each one
    // copied the whole array (immutability), so N images without annotations
    // meant N sequential copies of the entire array — O(n²) — plus N
    // notifications to subscribers (autosave included) instead of one.
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
  // A ref cache stabilises references per panel: as long as a panel's annotations
  // and index do not move, its objects are reused verbatim,
  // and if no panel changed the global array keeps its identity.
  const panelAnnotationsCacheRef = useRef<
    Map<
      string,
      {
        panel: (typeof storyboardPanels)[number];
        panelIdx: number;
        canvasWidth: number;
        canvasHeight: number;
        result: ReturnType<typeof annotationsOf>;
      }
    >
  >(new Map());
  const prevAllAnnotationsRef = useRef<ReturnType<typeof annotationsOf>>([]);

  const allAnnotations = useMemo(() => {
    let anyChanged = false;
    const cache = panelAnnotationsCacheRef.current;
    const newResults: ReturnType<typeof annotationsOf>[] = [];

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
      const anns = annotationsOf(panel);
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
  }, [storyboardPanels, annotationsOf, canvasWidth, canvasHeight]);

  // Where each clip sits on the global timeline.
  // Panel i > 0 starts where Panel i-1 ends, so that the gap before Panel i
  // is included in Panel i's boundary (clipOffsetMs).
  //
  // Every image gets one, including those that draw nothing: their absence
  // made `clipOffsetMs` fall back to its `?? 0`, and the narration restarted
  // from the beginning when switching to them. See panel-windows.ts.
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

  // Clip boundaries for the transition engine and the markers.
  // outgoing.endMs is the end of the outgoing panel's drawing,
  // incoming.startMs is the start of the incoming panel's drawing.
  const clipWindows = useMemo(
    () =>
      panelBoundaries.map((b, idx) => {
        const next = panelBoundaries[idx + 1];
        const blankMs = next ? Math.max(0, next.drawStartMs - b.drawEndMs) : 0;
        let transition = storyboardPanels[b.panelIdx]?.transition;

        if (blankMs > 0 && transition && transition.type !== "none") {
          transition = {
            ...transition,
            durationMs: blankMs,
          };
        } else {
          transition = transition ?? { type: "none", durationMs: blankMs };
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

  // An already prepared scene arrives within a few ms: the indicator only shows
  // beyond that, otherwise it would flicker on every switch.
  // Going through a callback instead of a state returned by the renderer
  // avoids 2 full editor re-renders on every quick switch (<150ms).
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

  // Proactive preloading of all storyboard images, prioritising
  // the next scene then the rest of the scenes to avoid freezes on jumps.
  const upcomingImageUrls = useMemo(() => {
    const nextIdx = activeClipIndex + 1;
    const urls: string[] = [];
    // Priority 1: scene N+1
    const nextUrl =
      storyboardPanels[nextIdx]?.imageUrl ||
      DEMO_STORYBOARD.panels[nextIdx % DEMO_STORYBOARD.panels.length]?.imageUrl;
    if (nextUrl) urls.push(nextUrl);

    // Priority 2: scene N+2
    const n2Url =
      storyboardPanels[nextIdx + 1]?.imageUrl ||
      DEMO_STORYBOARD.panels[(nextIdx + 1) % DEMO_STORYBOARD.panels.length]?.imageUrl;
    if (n2Url && !urls.includes(n2Url)) urls.push(n2Url);

    // Priority 3: rest of the storyboard scenes
    storyboardPanels.forEach((p, idx) => {
      const url = p.imageUrl || DEMO_STORYBOARD.panels[idx % DEMO_STORYBOARD.panels.length]?.imageUrl;
      if (url && !urls.includes(url)) urls.push(url);
    });

    return urls;
  }, [storyboardPanels, activeClipIndex]);

  const activeSavedAnnotations = useMemo(() => {
    if (activePanel) return annotationsOf(activePanel);
    if (config.annotations) return toEngineAnnotations(config.annotations);
    return null;
  }, [activePanel, annotationsOf, config.annotations]);

  const ghostImageUrl =
    activePanel?.imageUrl ||
    DEMO_STORYBOARD.panels[activeClipIndex % DEMO_STORYBOARD.panels.length]
      ?.imageUrl;

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
      // Per-beat voice takes precedence over the single track: it is what the pipeline
      // produces, and it need not be re-concatenated when a beat changes.
      narrationParts: config.narration ?? [],
      audioVolume: config.audio?.volume ?? 1,
      audioMuted: config.audio?.muted ?? false,
      audioDurationMs: config.narration?.length
        ? narrationEndMs(config.narration)
        : (config.audio?.durationMs ?? null),
      savedAnnotations: activeSavedAnnotations,
      // Global offset of the active clip on the shared narration clock. The
      // engine always receives 0-based annotations; the renderer translates.
      // The clip's origin for the engine is the start of its STROKE, not of the
      // panel: that is what `clipWindows` already publishes (startMs: drawStartMs),
      // and what the local sequence, brought back to zero, refers to.
      // Taking `startMs` shifted the drawing by the whole initial wait.
      clipOffsetMs:
        panelBoundaries.find((b) => b.panelIdx === activeClipIndex)
          ?.drawStartMs ?? 0,
      clips: clipWindows,
      onError: reportRenderError,
      onArtworkPendingChange: handleArtworkPendingChange,
    });

  // Read in an effect triggered by the active clip, not by the scrub: a value
  // in the dependencies would make it chase the state instead of reading it.
  const isScrubbingRef = useRef(isScrubbing);
  isScrubbingRef.current = isScrubbing;

  // ── Engine store = ALL scenes, flat ──────────────────────────────────────
  //
  // Loaded once (when the panels actually change), not on every scene
  // switch: changing the active scene no longer touches this array at all,
  // only `ui.activeScenePanelId` (see below), which just points the engine
  // elsewhere in the SAME data without recomputing or republishing anything.
  // This is what previously avoided rebuilding the drawing engine — down to
  // the spurious write to storage — on every move from one scene to another.
  const flatAnnotationsCacheRef = useRef<
    Map<
      string,
      {
        panel: (typeof storyboardPanels)[number];
        result: ReturnType<typeof annotationsOf>;
      }
    >
  >(new Map());
  const prevFlatAnnotationsRef = useRef<ReturnType<typeof annotationsOf>>([]);

  const flatAnnotations = useMemo(() => {
    let anyChanged = false;
    const cache = flatAnnotationsCacheRef.current;
    const newResults: ReturnType<typeof annotationsOf>[] = [];

    storyboardPanels.forEach((panel) => {
      const cached = cache.get(panel.id);
      if (cached && cached.panel === panel) {
        newResults.push(cached.result);
        return;
      }

      anyChanged = true;
      const res = annotationsOf(panel).map((a) => ({
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
  }, [storyboardPanels, annotationsOf]);

  useEffect(() => {
    const store = useUnifiedEngineStore.getState();
    if (store.animation.annotations === flatAnnotations) return;
    // Safety net: a recomputation with identical content (storyboardPanels
    // changed for an unrelated reason, an image title, etc.) must not
    // republish — same reason as for the write-back further down.
    if (!annotationsEqual(store.animation.annotations, flatAnnotations)) {
      store.setAnnotations(flatAnnotations);
    }
  }, [flatAnnotations]);

  // The DRAWN/EDITED scene is derived from the playback position — which is
  // already what activeClipIndex does below — and merely points into the
  // flat array above, without ever rewriting it.
  useEffect(() => {
    const engine = useUnifiedEngineStore.getState();
    engine.setActiveScenePanelId(activePanel?.id ?? null);
    engine.setSelectedAnnotation(null);
  }, [activePanel?.id]);

  // ── Sync engine annotation edits back to persistent storyboard store ──────
  //
  // An edit (overlay, list, timeline) only ever touches the active scene
  // in the engine store (see setSceneAnnotations/updateAnnotation);
  // so only its slice, extracted from the flat array, is compared
  // and rewritten — never the other scenes.
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
      // The store for persistence, the engine for rendering.
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
      const outgoingPanel = storyboard.storyboardPanels[panelIdx];
      const incomingPanel = storyboard.storyboardPanels[panelIdx + 1];
      if (!outgoingPanel?.transition) return;

      const newDuration = Math.max(50, durationMs);
      storyboard.updatePanel(outgoingPanel.id, {
        transition: {
          ...outgoingPanel.transition,
          durationMs: newDuration,
        },
      });

      if (incomingPanel) {
        const outgoingWindow = clipWindows[panelIdx];
        const incomingWindow = clipWindows[panelIdx + 1];
        const currentBlankMs =
          incomingWindow && outgoingWindow
            ? incomingWindow.startMs - outgoingWindow.endMs
            : 0;

        const deltaNeeded = newDuration - currentBlankMs;
        if (deltaNeeded !== 0) {
          const anns = annotationsOf(incomingPanel);
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
            storyboard.updatePanel(incomingPanel.id, {
              annotations: updatedStored,
            });
            useUnifiedEngineStore.getState().setSceneAnnotations(incomingPanel.id, anns);
          }
        }
      }
    },
    [clipWindows, annotationsOf],
  );

  const handleTransitionTypeChange = useCallback(
    (panelIdx: number, newType: string) => {
      const storyboard = useStoryboardStore.getState();
      const outgoingPanel = storyboard.storyboardPanels[panelIdx];
      const incomingPanel = storyboard.storyboardPanels[panelIdx + 1];
      if (!outgoingPanel) return;

      const currentDuration =
        outgoingPanel.transition?.durationMs ?? 300;
      storyboard.updatePanel(outgoingPanel.id, {
        transition: {
          type: newType as any,
          durationMs: currentDuration,
        },
      });

      if (newType === "none" && incomingPanel) {
        const anns = annotationsOf(incomingPanel);
        if (anns.length > 0 && (anns[0].reveal.gapBeforeMs ?? 0) > 0) {
          anns[0] = {
            ...anns[0],
            reveal: {
              ...anns[0].reveal,
              gapBeforeMs: 0,
            },
          };
          const updatedStored = toStoredAnnotations(anns);
          storyboard.updatePanel(incomingPanel.id, {
            annotations: updatedStored,
          });
          useUnifiedEngineStore.getState().setSceneAnnotations(incomingPanel.id, anns);
        }
      } else if (newType !== "none" && incomingPanel) {
        const outgoingWindow = clipWindows[panelIdx];
        const incomingWindow = clipWindows[panelIdx + 1];
        const currentBlankMs =
          incomingWindow && outgoingWindow
            ? incomingWindow.startMs - outgoingWindow.endMs
            : 0;

        if (currentBlankMs === 0) {
          const anns = annotationsOf(incomingPanel);
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
            storyboard.updatePanel(incomingPanel.id, {
              annotations: updatedStored,
            });
            useUnifiedEngineStore.getState().setSceneAnnotations(incomingPanel.id, anns);
          }
        }
      }
    },
    [clipWindows, annotationsOf],
  );

  return (
    <div className="w-full h-full flex gap-4 overflow-hidden py-2 no-scrollbars">
      {/* Column 1: Vertical Clip Selector Sidebar */}
      <ClipSelectorBar />

      {/* Column 2: Canvas Preview & Annotation Timeline */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 overflow-hidden">
        {/* Canvas Container */}
        {/* The canvas takes all the height left by the timeline, in the project's
            format: its size derives from the available space, not a fixed height. */}
        <div className="relative flex-1 min-h-0 rounded-xl border-2 border-ink bg-card shadow-[6px_6px_0_hsl(var(--offset))] flex flex-col overflow-hidden">
          <span className="sk-tape" aria-hidden="true" />
          <div className="flex shrink-0 items-center justify-between border-b-2 border-ink bg-muted/20 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-ink bg-highlight px-2 py-0.5 text-[10px] font-bold tabular-nums text-highlight-foreground shadow-[1px_1px_0_hsl(var(--offset))]">
                {activeClipIndex + 1}
              </span>
              <span className="text-xs font-bold text-foreground">
                {activePanel?.title || `Scene ${activeClipIndex + 1}`}
              </span>
            </div>

            <div
              role="tablist"
              aria-label="Editor mode"
              className="flex items-center gap-1 rounded-full border-2 border-ink bg-card p-1 shadow-[2px_2px_0_hsl(var(--offset))]"
            >
              {(
                [
                  { key: "edit", label: "Edit", Icon: Pencil, hint: "place and resize the zones on the full image" },
                  { key: "preview", label: "Preview", Icon: Play, hint: "watch the hand draw it with the voice" },
                ] as const
              ).map(({ key, label, Icon, hint }) => (
                <Hint key={key} label={hint} side="bottom">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => switchMode(key)}
                  className={`flex h-8 items-center justify-center gap-2 rounded-full border-2 px-5 text-xs font-semibold transition-all ${
                    mode === key
                      ? "border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))] font-bold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
                </Hint>
              ))}
            </div>

            <span className="sk-scribble text-base text-foreground/80 rotate-2 select-none" aria-hidden="true">
              {String(activeClipIndex + 1).padStart(2, "0")} / {String(storyboardPanels.length || 1).padStart(2, "0")}
            </span>
          </div>
          <div className="flex-1 min-h-0 p-4 flex flex-col justify-center items-center">
          <div className="h-full w-full flex items-center justify-center [container-type:size]">
            <div
              className="rounded-lg border-2 border-ink bg-white overflow-hidden relative shadow-[3px_3px_0_hsl(var(--offset))]"
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
              {/* Edit mode shows the finished artwork, not the reveal in progress. */}
              {mode === "edit" && ghostImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ghostImageUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 z-[25] h-full w-full bg-white object-contain pointer-events-none"
                />
              )}
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
              {/* Annotation editing layer. It hides the drawing you came to watch, so
                  it fades out during playback and comes back when stopped, end of playback
                  included — hence isOverlayHidden, which use-whiteboard-renderer computes
                  also knowing when scrubbing happens. */}

              <AnnotationOverlay
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                hidden={mode === "preview" || isOverlayHidden}
              />
            </div>
          </div>
          </div>
        </div>

        {/* Annotation timeline, with the narration lane below it. The playhead
            is drawn by the timeline itself, so the lane has to borrow the same
            scale and scroll offset to stay under it. */}
        {/* Hidden, not unmounted: the timeline owns the playhead viewport the renderer relies on. */}
        <div className={`relative shrink-0 rounded-xl border-2 border-ink bg-card shadow-[6px_6px_0_hsl(var(--offset))] overflow-hidden ${mode === "edit" ? "hidden" : ""}`}>
          <span className="sk-tape" aria-hidden="true" />
          <ScriptSegmentsCard
            sceneStartMs={
              panelBoundaries.find((b) => b.panelIdx === activeClipIndex)
                ?.startMs ?? 0
            }
          />

          <div className="relative">
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
      </div>

      {/* Right: settings, then the annotation sequence. This list is what
          justifies the rail: it needs all the available height, where
          two controls alone did not fill it. */}
      <div className="w-80 shrink-0 min-h-0 flex flex-col overflow-hidden rounded-xl border-2 border-ink bg-card shadow-[4px_4px_0_hsl(var(--offset))]">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b-2 border-ink px-3 bg-muted/20">
          <span className="rounded-full border border-ink bg-highlight px-2 py-0.5 text-[10px] font-bold tabular-nums text-highlight-foreground shadow-[1px_1px_0_hsl(var(--offset))]">
            {activeClipIndex + 1}
          </span>
          <span className="truncate text-xs font-bold text-foreground">
            {activePanel?.title || `Scene ${activeClipIndex + 1}`}
          </span>
        </header>
        <div className="m-2 flex shrink-0 justify-center">
          <div
            role="tablist"
            aria-label="Side panel"
            className="flex items-center gap-1 rounded-full border-2 border-ink bg-card p-1 shadow-[2px_2px_0_hsl(var(--offset))]"
          >
            {(["scene", "annotations"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={sideTab === tab}
                onClick={() => setSideTab(tab)}
                className={`flex h-8 items-center justify-center gap-1.5 rounded-full border-2 px-5 text-xs font-semibold transition-all ${
                  sideTab === tab
                    ? "border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))] font-bold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "scene" ? "Scene" : "Annotations"}
                {tab === "annotations" && <AnnotationCountBadge />}
              </button>
            ))}
          </div>
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
