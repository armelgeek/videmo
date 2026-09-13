"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Annotation } from "@/lib/unified-engine/types";
import type { TimelineClip } from "@/lib/editor/types";
import { poserPositionLecture } from "@/lib/editor/playback-clock";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { selectSceneAnnotations } from "@/lib/unified-engine/hooks/selectors";
import { useStoryboardStore } from "@/lib/storyboard/store";
import { applyEditorEdit, type TimelineEdit } from "./apply-editor-edit";
import { toEngineAnnotations, toStoredAnnotations } from "./annotation-interop";
import { deriveTimeline } from "./derive-timeline";
import { interpretClipUpdate } from "./interpret-clip-update";
import { toEditorTimeline } from "./to-editor-timeline";
import { annotationPleineImage } from "./panel-fallback-annotation";
import { tailleCanvas } from "../canvas-size";

/**
 * Retrouve le panneau proprietaire d'un id d'annotation de la chaine globale,
 * et l'id LOCAL a ce panneau — inverse exact du prefixage fait dans
 * whiteboard-editor-step.tsx (`p${panelIdx}-${id}`).
 */
function panneauDe(id: string): { panelIdx: number; localId: string } | null {
  const m = id.match(/^p(\d+)-(.+)$/);
  return m ? { panelIdx: Number(m[1]), localId: m[2] } : null;
}

const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 10;
const MAX_ZOOM = 400;
const READABLE_ZOOM = 60;
const NOOP = () => {};
const EMPTY_SELECTED_CLIPS: string[] = [];

/**
 * Wires the unified engine store to the NLE timeline component.
 *
 * When `globalAnnotations` is provided, the timeline displays that sequence
 * (all clips chained) while the engine store keeps only the active panel's
 * annotations for canvas rendering. Writes still go through applyEditorEdit
 * on the active-panel annotations in the store.
 */
export function useAnnotationTimeline(globalAnnotations?: Annotation[]) {
  // Scene active seulement : le store porte toutes les scenes a plat.
  const storeAnnotations = useUnifiedEngineStore(selectSceneAnnotations);
  /** Source of truth for DISPLAY: global sequence when provided, active panel otherwise. */
  const annotations = globalAnnotations ?? storeAnnotations;
  const videoDuration = useUnifiedEngineStore((s) => s.timeline.duration);

  // La barre de transport est PARTAGEE avec l'editeur, et son compteur suit
  // desormais `playback-clock` plutot qu'une prop. Cet ecran, lui, porte sa
  // position dans le store du moteur : sans ce pont son timecode resterait a
  // zero pendant toute la lecture, et le pas image par image partirait de la.
  //
  // L'abonnement est IMPERATIF, et c'est tout l'enjeu : lire cette position
  // avec un selecteur React rendrait ce hook — donc la timeline entiere — a
  // chaque publication de l'horloge, ce que la refonte a precisement supprime.
  // Ici la valeur passe du store a l'horloge sans traverser un seul rendu.
  //
  // Le pont vit a ce niveau plutot que dans la boucle de rendu : le store
  // change aussi quand on scrube ou qu'on choisit un clip, et ces
  // deplacements-la doivent s'afficher comme les autres.
  useEffect(() => {
    const publier = (ms: number) => poserPositionLecture(ms / 1000);
    publier(useUnifiedEngineStore.getState().timeline.currentTime);
    return useUnifiedEngineStore.subscribe((s) =>
      publier(s.timeline.currentTime),
    );
  }, []);
  // Read from the project rather than inferred from the timeline: it must stay
  // a fixed ceiling for the whole of a drag.
  const narrationMs = useStoryboardStore(
    (s) => s.whiteboardConfig.audio?.durationMs ?? 0,
  );
  const isPlaying = useUnifiedEngineStore((s) => s.timeline.isPlaying);
  const fps = useUnifiedEngineStore((s) => s.timeline.fps);
  const selectedClipId = useUnifiedEngineStore((s) => s.ui.selectedClipId);

  const setAnnotations = useUnifiedEngineStore((s) => s.setAnnotations);
  const setSceneAnnotations = useUnifiedEngineStore((s) => s.setSceneAnnotations);
  const setCurrentTime = useUnifiedEngineStore((s) => s.setCurrentTime);
  const togglePlay = useUnifiedEngineStore((s) => s.togglePlay);
  const setSelectedClip = useUnifiedEngineStore((s) => s.setSelectedClip);
  const setSelectedAnnotation = useUnifiedEngineStore(
    (s) => s.setSelectedAnnotation,
  );

  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const userChoseZoom = useRef(false);
  const [tool, setTool] = useState<"select" | "razor">("select");

  const derived = useMemo(() => deriveTimeline(annotations), [annotations]);
  const view = useMemo(() => toEditorTimeline(derived), [derived]);

  const storyboardPanels = useStoryboardStore((s) => s.storyboardPanels);
  const aspectRatio = useStoryboardStore((s) => s.projectParams.aspectRatio);

  const edit = useCallback(
    (change: TimelineEdit) => {
      // The cap is the NARRATION, not the current video length.
      //
      // A drag calls this on every mousemove. Deriving the cap from
      // `videoDuration > drawingMs` made it disappear the instant the first
      // clamp brought the drawing up to the video length: the condition went
      // false and the rest of the drag ran unclamped, so a clip could still be
      // stretched well past the end.
      //
      // With no narration the annotations themselves define the length, the
      // video simply grows with them, and capping would freeze them.
      const capMs = narrationMs > 0 ? narrationMs : undefined;

      // Les ids touches par ce changement : `id` sur 4 variantes, `ids` sur
      // delete/duplicate. Sans prefixe pN- (chaine locale a un seul panneau,
      // globalAnnotations absent), on retombe sur le comportement d'origine :
      // ecriture directe dans le store, aucun panneau a router.
      const idsBruts = "id" in change ? [change.id] : change.ids;
      const decodes = idsBruts.map(panneauDe);

      if (!globalAnnotations || decodes.some((d) => d === null)) {
        setAnnotations(applyEditorEdit(change, annotations, capMs));
        return;
      }

      // Regroupe par panneau : delete/duplicate peuvent viser plusieurs
      // panneaux a la fois, mais applyEditorEdit ne doit jamais voir plus
      // d'un panneau a la fois.
      const parPanneau = new Map<number, string[]>();
      decodes.forEach((d) => {
        if (!d) return;
        const liste = parPanneau.get(d.panelIdx) ?? [];
        liste.push(d.localId);
        parPanneau.set(d.panelIdx, liste);
      });

      parPanneau.forEach((localIds, panelIdx) => {
        const panel = storyboardPanels[panelIdx];
        if (!panel) return;

        // Une image sans annotation n'affiche qu'un clip de VUE. La premiere
        // edition le materialise dans le projet : sans cela applyEditorEdit
        // travaillait sur une liste vide et le geste restait sans effet, alors
        // que le clip repondait a la souris.
        const existantes = toEngineAnnotations(panel.annotations ?? []);
        const locales =
          existantes.length > 0
            ? existantes
            : [annotationPleineImage(panel, tailleCanvas(aspectRatio))];

        // Reconstruit un TimelineEdit purement LOCAL a ce panneau : les ids
        // globaux (pN-xxx) redeviennent les ids locaux que ce panneau connait.
        const changeLocal: TimelineEdit =
          "id" in change
            ? { ...change, id: localIds[0] }
            : { ...change, ids: localIds };

        const misesAJour = applyEditorEdit(changeLocal, locales, capMs);
        const stockees = toStoredAnnotations(misesAJour);

        useStoryboardStore.getState().updatePanel(panel.id, { annotations: stockees });

        // Le store moteur porte TOUTES les scenes a plat : on n'y remplace
        // que la tranche de CE panneau, actif ou non.
        setSceneAnnotations(panel.id, misesAJour);
      });
    },
    [annotations, globalAnnotations, storyboardPanels, setAnnotations, setSceneAnnotations, narrationMs, aspectRatio],
  );

  const onClipUpdate = useCallback(
    (clipId: string, changes: Partial<TimelineClip>) => {
      const clip = view.clips.find((c) => c.id === clipId);
      if (!clip) return;

      const index = view.clips.findIndex((c) => c.id === clipId);
      const previous = index > 0 ? view.clips[index - 1] : null;
      const previousEndSeconds = previous
        ? previous.start + previous.duration
        : 0;

      const change = interpretClipUpdate(changes, { clip, previousEndSeconds });
      if (change) edit(change);
    },
    [edit, view.clips],
  );

  const onSelectClips = useCallback(
    (clipIds: string[]) => {
      const [id = null] = clipIds;
      setSelectedClip(id);
      if (id === null) {
        setSelectedAnnotation(null);
        return;
      }
      // Index local a la scene active : globalAnnotations porte le prefixe 'p{panelIdx}-'
      const activeIdx = useStoryboardStore.getState().activeClipIndex;
      const sceneAnns = selectSceneAnnotations(useUnifiedEngineStore.getState());
      const localIdx = sceneAnns.findIndex(
        (a) => a.id === id || `p${activeIdx}-${a.id}` === id,
      );
      setSelectedAnnotation(localIdx >= 0 ? localIdx : null);
    },
    [setSelectedClip, setSelectedAnnotation],
  );

  const onZoomChange = useCallback((zoom: number) => {
    userChoseZoom.current = true;
    setZoomLevel(zoom);
  }, []);

  const onSeek = useCallback(
    (seconds: number) => setCurrentTime(Math.round(seconds * 1000)),
    [setCurrentTime],
  );

  const onDeleteClip = useCallback(
    (ids: string[]) => edit({ kind: "delete", ids }),
    [edit],
  );
  const onRippleDeleteClip = useCallback(
    (ids: string[]) => edit({ kind: "delete", ids }),
    [edit],
  );
  const onDuplicateClip = useCallback(
    (ids: string[]) => edit({ kind: "duplicate", ids }),
    [edit],
  );
  const onSplitClip = useCallback(
    (id: string, atSeconds: number) => edit({ kind: "split", id, atSeconds }),
    [edit],
  );

  const fitZoomTo = useCallback((availableWidth: number, durationSeconds: number) => {
    if (userChoseZoom.current) return;
    if (availableWidth <= 0 || durationSeconds <= 0) return;

    const fitted = Math.min(
      MAX_ZOOM,
      Math.max(READABLE_ZOOM, availableWidth / durationSeconds),
    );
    setZoomLevel((current) =>
      Math.abs(current - fitted) < 1 ? current : fitted,
    );
  }, []);

  const selectedClipIds = useMemo(
    () => (selectedClipId ? [selectedClipId] : EMPTY_SELECTED_CLIPS),
    [selectedClipId],
  );

  const duration =
    videoDuration > 0 ? videoDuration / 1000 : view.durationSeconds;

  return useMemo(
    () => ({
      // Data
      tracks: view.tracks,
      clips: view.clips,
      mediaMap: view.mediaMap,
      duration,
      frameRate: fps,
      isPlaying,
      selectedClipIds,

      // Local UI state
      zoomLevel,
      tool,
      onZoomChange,
      onToolChange: setTool,
      onDragStart: NOOP,

      // Playback
      onSeek,
      onPlayPause: togglePlay,
      isLooping: false,
      onToggleLoop: NOOP,

      // Editing
      onClipUpdate,
      onSelectClips,
      onDeleteClip,
      onRippleDeleteClip,
      onDuplicateClip,
      onSplitClip,

      // Not meaningful for annotations: a single fixed track, no source media.
      onTrackUpdate: NOOP,
      onDetachAudio: NOOP,

      fitZoomTo,
    }),
    [
      view.tracks,
      view.clips,
      view.mediaMap,
      duration,
      fps,
      isPlaying,
      selectedClipIds,
      zoomLevel,
      tool,
      onZoomChange,
      onSeek,
      togglePlay,
      onClipUpdate,
      onSelectClips,
      onDeleteClip,
      onRippleDeleteClip,
      onDuplicateClip,
      onSplitClip,
      fitZoomTo,
    ],
  );
}
