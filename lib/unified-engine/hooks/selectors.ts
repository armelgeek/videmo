import type { Annotation, UnifiedEngineState } from '../types';

/** Une annotation sans scene (mode demo) appartient a toutes. */
export const belongsToScene = (a: Annotation, panelId: string | null) =>
  panelId === null || a.panelId === undefined || a.panelId === panelId;

/**
 * Extrait les annotations d'une scene depuis le tableau de toutes les scenes.
 *
 * `panelId: null` rend le tableau tel quel (pas de notion de scene — mode
 * demo/standalone, comportement d'avant le passage au tableau plat).
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
 * Version memorisee de `filterScene`, pour l'utiliser comme selecteur zustand.
 *
 * Un selecteur qui rend un tableau neuf a chaque appel fait re-rendre sans
 * fin. Et quand seule une AUTRE scene a change, la meme reference est rendue,
 * pour ne pas reconstruire le moteur de dessin de la scene affichee.
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
