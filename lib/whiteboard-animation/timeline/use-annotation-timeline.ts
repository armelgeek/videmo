"use client";

import { useCallback, useMemo, useState } from "react";
import type { TimelineClip } from "@/lib/editor/types";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { applyEditorEdit, type TimelineEdit } from "./apply-editor-edit";
import { deriveTimeline } from "./derive-timeline";
import { interpretClipUpdate } from "./interpret-clip-update";
import { toEditorTimeline } from "./to-editor-timeline";

const DEFAULT_ZOOM = 100;

/**
 * Wires the unified engine store to the NLE timeline component.
 *
 * Every write funnels through applyEditorEdit, so the derived model is the only
 * thing that ever reaches the store.
 */
export function useAnnotationTimeline() {
  const annotations = useUnifiedEngineStore((s) => s.animation.annotations);
  const currentTime = useUnifiedEngineStore((s) => s.timeline.currentTime);
  const isPlaying = useUnifiedEngineStore((s) => s.timeline.isPlaying);
  const fps = useUnifiedEngineStore((s) => s.timeline.fps);
  const selectedClipId = useUnifiedEngineStore((s) => s.ui.selectedClipId);

  const setAnnotations = useUnifiedEngineStore((s) => s.setAnnotations);
  const setCurrentTime = useUnifiedEngineStore((s) => s.setCurrentTime);
  const togglePlay = useUnifiedEngineStore((s) => s.togglePlay);
  const setSelectedClip = useUnifiedEngineStore((s) => s.setSelectedClip);
  const setSelectedAnnotation = useUnifiedEngineStore(
    (s) => s.setSelectedAnnotation,
  );

  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const [tool, setTool] = useState<"select" | "razor">("select");

  const derived = useMemo(() => deriveTimeline(annotations), [annotations]);
  const view = useMemo(() => toEditorTimeline(derived), [derived]);

  const edit = useCallback(
    (change: TimelineEdit) => {
      setAnnotations(applyEditorEdit(change, annotations));
    },
    [annotations, setAnnotations],
  );

  const onClipUpdate = useCallback(
    (clipId: string, changes: Partial<TimelineClip>) => {
      const clip = view.clips.find((c) => c.id === clipId);
      if (!clip) return;

      const gapSeconds =
        (annotations.find((a) => a.id === clipId)?.reveal.gapBeforeMs ?? 0) / 1000;

      const change = interpretClipUpdate(changes, { clip, gapSeconds });
      if (change) edit(change);
    },
    [annotations, edit, view.clips],
  );

  const onSelectClips = useCallback(
    (clipIds: string[]) => {
      const [id = null] = clipIds;
      setSelectedClip(id);
      setSelectedAnnotation(
        id === null ? null : annotations.findIndex((a) => a.id === id),
      );
    },
    [annotations, setSelectedClip, setSelectedAnnotation],
  );

  return {
    // Data
    tracks: view.tracks,
    clips: view.clips,
    mediaMap: view.mediaMap,
    duration: view.durationSeconds,
    currentTime: currentTime / 1000,
    frameRate: fps,
    isPlaying,
    selectedClipIds: selectedClipId ? [selectedClipId] : [],

    // Local UI state
    zoomLevel,
    tool,
    onZoomChange: setZoomLevel,
    onToolChange: setTool,
    onDragStart: () => {},

    // Playback
    onSeek: (seconds: number) => setCurrentTime(Math.round(seconds * 1000)),
    onPlayPause: togglePlay,
    isLooping: false,
    onToggleLoop: () => {},

    // Editing
    onClipUpdate,
    onSelectClips,
    onDeleteClip: (ids: string[]) => edit({ kind: "delete", ids }),
    onRippleDeleteClip: (ids: string[]) => edit({ kind: "delete", ids }),
    onDuplicateClip: (ids: string[]) => edit({ kind: "duplicate", ids }),
    onSplitClip: (id: string, atSeconds: number) =>
      edit({ kind: "split", id, atSeconds }),

    // Not meaningful for annotations: a single fixed track, no source media.
    onTrackUpdate: () => {},
    onDetachAudio: () => {},
  };
}
