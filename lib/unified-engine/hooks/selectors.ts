import type { Annotation, UnifiedEngineState } from '../types';

/** An annotation without a scene (demo mode) belongs to all of them. */
export const belongsToScene = (a: Annotation, panelId: string | null) =>
  panelId === null || a.panelId === undefined || a.panelId === panelId;

/**
 * Extracts one scene's annotations from the array of all scenes.
 *
 * `panelId: null` returns the array as-is (no notion of scene — demo/standalone
 * mode, the behaviour from before the switch to a flat array).
 */
export function filterScene(
  annotations: Annotation[],
  panelId: string | null,
): Annotation[] {
  return panelId === null ? annotations : annotations.filter((a) => belongsToScene(a, panelId));
}

let sceneSource: Annotation[] | null = null;
let scenePanelId: string | null = null;
let sceneResult: Annotation[] = [];

/**
 * Memoized version of `filterScene`, for use as a zustand selector.
 *
 * A selector that returns a new array on every call causes endless re-renders.
 * And when only ANOTHER scene changed, the same reference is returned so the
 * drawing engine of the displayed scene is not rebuilt.
 */
export const selectSceneAnnotations = (state: UnifiedEngineState): Annotation[] => {
  const source = state.animation.annotations;
  const panelId = state.ui.activeScenePanelId;
  if (source === sceneSource && panelId === scenePanelId) return sceneResult;

  const next = filterScene(source, panelId);
  const unchanged =
    panelId === scenePanelId &&
    next.length === sceneResult.length &&
    next.every((a, i) => a === sceneResult[i]);

  sceneSource = source;
  scenePanelId = panelId;
  if (!unchanged) sceneResult = next;
  return sceneResult;
};

// Timeline Selectors
export const selectCurrentTime = (state: UnifiedEngineState) => state.timeline.currentTime;
export const selectDuration = (state: UnifiedEngineState) => state.timeline.duration;
export const selectIsPlaying = (state: UnifiedEngineState) => state.timeline.isPlaying;
export const selectFps = (state: UnifiedEngineState) => state.timeline.fps;
export const selectClips = (state: UnifiedEngineState) => state.timeline.clips;

// Derived: Progress percentage
export const selectProgress = (state: UnifiedEngineState) =>
  state.timeline.duration > 0
    ? (state.timeline.currentTime / state.timeline.duration) * 100
    : 0;

// Derived: Remaining time
export const selectRemainingTime = (state: UnifiedEngineState) =>
  state.timeline.duration - state.timeline.currentTime;

// Animation Selectors
export const selectAnimStyle = (state: UnifiedEngineState) => state.animation.animStyle;
export const selectHandStyle = (state: UnifiedEngineState) => state.animation.handStyle;
export const selectRevealSpeed = (state: UnifiedEngineState) => state.animation.revealSpeed;
export const selectHandSpeed = (state: UnifiedEngineState) => state.animation.handSpeed;
export const selectChunks = (state: UnifiedEngineState) => state.animation.chunks;
export const selectCanvasBg = (state: UnifiedEngineState) => state.animation.canvasBg;
export const selectUseAnnotation = (state: UnifiedEngineState) => state.animation.useAnnotation;
export const selectAnnotations = (state: UnifiedEngineState) => state.animation.annotations;
export const selectLayers = (state: UnifiedEngineState) => state.animation.layers;

// Canvas Selectors
export const selectCanvasWidth = (state: UnifiedEngineState) => state.canvas.width;
export const selectCanvasHeight = (state: UnifiedEngineState) => state.canvas.height;
export const selectAspectRatio = (state: UnifiedEngineState) => state.canvas.aspectRatio;
export const selectResolution = (state: UnifiedEngineState) => state.canvas.resolution;

// UI Selectors
export const selectSelectedClipId = (state: UnifiedEngineState) => state.ui.selectedClipId;
export const selectSelectedAnnotationIndex = (state: UnifiedEngineState) => state.ui.selectedAnnotationIndex;
export const selectActivePanel = (state: UnifiedEngineState) => state.ui.activePanel;
export const selectError = (state: UnifiedEngineState) => state.ui.error;
