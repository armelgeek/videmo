'use client';

import { useShallow } from 'zustand/react/shallow';
import { useUnifiedEngineStore } from '../context';
import * as selectors from './selectors';
import type { UnifiedEngineStore } from '../types';

// UnifiedEngineStore, not UnifiedEngineState: the latter omits the actions,
// yet a custom selector commonly reads them (setAnimStyle, etc.) just like
// the state.
type Selector = (state: UnifiedEngineStore) => any;

export function useUnifiedEngine<T = any>(selector?: Selector): T {
  // useShallow applies to BOTH branches: a custom selector returning an
  // object literal (like the ones below) rebuilds it on every render, and
  // without shallow-compare it would re-render on EVERY change of the whole
  // store, not just the fields read. A shallow comparison on a primitive
  // stays equivalent to strict equality: nothing changes for a selector that
  // already returns a plain value.
  if (selector) {
    return useUnifiedEngineStore(useShallow(selector)) as T;
  }

  // Flat view of the nested store. useShallow compares field by field, so the
  // fresh object literal below does not retrigger a render on every store read.
  return useUnifiedEngineStore(
    useShallow((state) => ({
      // Timeline
      currentTime: selectors.selectCurrentTime(state),
      duration: selectors.selectDuration(state),
      isPlaying: selectors.selectIsPlaying(state),
      progress: selectors.selectProgress(state),
      fps: selectors.selectFps(state),
      clips: selectors.selectClips(state),

      // Animation
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
      resolution: selectors.selectResolution(state),

      // UI
      activePanel: selectors.selectActivePanel(state),
      selectedClipId: selectors.selectSelectedClipId(state),
      selectedAnnotationIndex: selectors.selectSelectedAnnotationIndex(state),
      error: selectors.selectError(state),

      // Actions
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
    }))
  ) as T;
}
