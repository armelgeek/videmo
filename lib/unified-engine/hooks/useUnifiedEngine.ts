'use client';

import { useUnifiedEngineStore } from '../context';
import * as selectors from './selectors';
import type { UnifiedEngineState } from '../types';

type Selector = (state: UnifiedEngineState) => any;

export function useUnifiedEngine<T = any>(selector?: Selector): T {
  if (selector) {
    return useUnifiedEngineStore(selector);
  }

  // No selector: return a stable object with commonly used selectors + all actions
  return useUnifiedEngineStore((state) => ({
    // Most common timeline state
    currentTime: selectors.selectCurrentTime(state),
    duration: selectors.selectDuration(state),
    isPlaying: selectors.selectIsPlaying(state),
    progress: selectors.selectProgress(state),
    fps: selectors.selectFps(state),

    // Most common animation state
    animStyle: selectors.selectAnimStyle(state),
    handStyle: selectors.selectHandStyle(state),
    revealSpeed: selectors.selectRevealSpeed(state),
    handSpeed: selectors.selectHandSpeed(state),
    chunks: selectors.selectChunks(state),
    canvasBg: selectors.selectCanvasBg(state),
    useAnnotation: selectors.selectUseAnnotation(state),
    annotations: selectors.selectAnnotations(state),
    layers: selectors.selectLayers(state),

    // Canvas
    canvasWidth: selectors.selectCanvasWidth(state),
    canvasHeight: selectors.selectCanvasHeight(state),
    aspectRatio: selectors.selectAspectRatio(state),

    // UI
    activePanel: selectors.selectActivePanel(state),
    selectedAnnotationIndex: selectors.selectSelectedAnnotationIndex(state),

    // All actions
    setCurrentTime: state.setCurrentTime,
    setIsPlaying: state.setIsPlaying,
    togglePlay: state.togglePlay,
    setDuration: state.setDuration,
    setFps: state.setFps,
    setAnimStyle: state.setAnimStyle,
    setHandStyle: state.setHandStyle,
    setRevealSpeed: state.setRevealSpeed,
    setHandSpeed: state.setHandSpeed,
    setChunks: state.setChunks,
    setCanvasBg: state.setCanvasBg,
    setUseAnnotation: state.setUseAnnotation,
    updateAnnotation: state.updateAnnotation,
    addAnnotation: state.addAnnotation,
    removeAnnotation: state.removeAnnotation,
    addLayer: state.addLayer,
    updateLayer: state.updateLayer,
    removeLayer: state.removeLayer,
    setCanvasSize: state.setCanvasSize,
    setAspectRatio: state.setAspectRatio,
    setResolution: state.setResolution,
    setSelectedClip: state.setSelectedClip,
    setSelectedAnnotation: state.setSelectedAnnotation,
    setActivePanel: state.setActivePanel,
    setError: state.setError,
    reset: state.reset,
  })) as T;
}
