import type { UnifiedEngineState } from '../types';

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
