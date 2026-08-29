'use client';

import { create } from 'zustand';
import type { UnifiedEngineStore, UnifiedEngineState, Annotation, InkplainerLayer } from '../types';

const DEFAULT_CANVAS_WIDTH = 1280;
const DEFAULT_CANVAS_HEIGHT = 720;

const initialState: UnifiedEngineState = {
  timeline: {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    fps: 60,
    clips: [],
  },
  animation: {
    layers: [
      {
        id: '1',
        name: 'scene-premium-bag',
        x: 0,
        y: 0,
        w: DEFAULT_CANVAS_WIDTH,
        h: DEFAULT_CANVAS_HEIGHT,
        opacity: 1,
        visible: true,
        animStyle: 'chunkjump',
        handStyle: 'custom1',
        speed: 40,
        handSpeed: 6,
      },
    ],
    animStyle: 'chunkjump',
    handStyle: 'custom1',
    revealSpeed: 40,
    handSpeed: 6,
    chunks: 5,
    canvasBg: '#ffffff',
    useAnnotation: false,
    annotations: [],
  },
  canvas: {
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
    aspectRatio: '16:9',
    resolution: '720p',
  },
  ui: {
    selectedClipId: null,
    selectedAnnotationIndex: null,
    activePanel: 'timeline',
    isLoading: false,
    error: null,
  },
};

export const useUnifiedEngineStore = create<UnifiedEngineStore>((set, get) => ({
  ...initialState,

  // Timeline & Playback
  setCurrentTime: (time: number) => {
    set((state) => ({
      timeline: {
        ...state.timeline,
        currentTime: Math.max(0, Math.min(time, state.timeline.duration)),
      },
    }));
  },

  setIsPlaying: (playing: boolean) => {
    set((state) => ({
      timeline: { ...state.timeline, isPlaying: playing },
    }));
  },

  togglePlay: () => {
    set((state) => ({
      timeline: { ...state.timeline, isPlaying: !state.timeline.isPlaying },
    }));
  },

  setDuration: (duration: number) => {
    set((state) => ({
      timeline: {
        ...state.timeline,
        duration: Math.max(0, duration),
        currentTime: Math.min(state.timeline.currentTime, duration),
      },
    }));
  },

  setFps: (fps: number) => {
    set((state) => ({
      timeline: { ...state.timeline, fps: Math.max(1, fps) },
    }));
  },

  // Animation Settings
  setAnimStyle: (animStyle: string) => {
    set((state) => ({
      animation: { ...state.animation, animStyle },
    }));
  },

  setHandStyle: (handStyle: string) => {
    set((state) => ({
      animation: { ...state.animation, handStyle },
    }));
  },

  setRevealSpeed: (revealSpeed: number) => {
    set((state) => ({
      animation: { ...state.animation, revealSpeed: Math.max(0, Math.min(100, revealSpeed)) },
    }));
  },

  setHandSpeed: (handSpeed: number) => {
    set((state) => ({
      animation: { ...state.animation, handSpeed: Math.max(0, Math.min(100, handSpeed)) },
    }));
  },

  setChunks: (chunks: number) => {
    set((state) => ({
      animation: { ...state.animation, chunks: Math.max(1, chunks) },
    }));
  },

  setCanvasBg: (canvasBg: string) => {
    set((state) => ({
      animation: { ...state.animation, canvasBg },
    }));
  },

  setUseAnnotation: (useAnnotation: boolean) => {
    set((state) => ({
      animation: { ...state.animation, useAnnotation },
    }));
  },

  // Annotations
  updateAnnotation: (index: number, data: Partial<Annotation>) => {
    set((state) => {
      const annotations = [...state.animation.annotations];
      if (annotations[index]) {
        annotations[index] = { ...annotations[index], ...data };
      }
      return { animation: { ...state.animation, annotations } };
    });
  },

  addAnnotation: (annotation: Annotation) => {
    set((state) => ({
      animation: {
        ...state.animation,
        annotations: [...state.animation.annotations, annotation],
      },
    }));
  },

  removeAnnotation: (id: string) => {
    set((state) => ({
      animation: {
        ...state.animation,
        annotations: state.animation.annotations.filter((a) => a.id !== id),
      },
    }));
  },

  // Layers
  addLayer: (layer: InkplainerLayer) => {
    set((state) => ({
      animation: {
        ...state.animation,
        layers: [...state.animation.layers, layer],
      },
    }));
  },

  updateLayer: (id: string, data: Partial<InkplainerLayer>) => {
    set((state) => ({
      animation: {
        ...state.animation,
        layers: state.animation.layers.map((layer) =>
          layer.id === id ? { ...layer, ...data } : layer
        ),
      },
    }));
  },

  removeLayer: (id: string) => {
    set((state) => ({
      animation: {
        ...state.animation,
        layers: state.animation.layers.filter((layer) => layer.id !== id),
      },
    }));
  },

  // Canvas
  setCanvasSize: (width: number, height: number) => {
    set((state) => ({
      canvas: { ...state.canvas, width, height },
    }));
  },

  setAspectRatio: (aspectRatio: string) => {
    set((state) => ({
      canvas: { ...state.canvas, aspectRatio },
    }));
  },

  setResolution: (resolution: string) => {
    set((state) => ({
      canvas: { ...state.canvas, resolution },
    }));
  },

  // UI
  setSelectedClip: (selectedClipId: string | null) => {
    set((state) => ({
      ui: { ...state.ui, selectedClipId },
    }));
  },

  setSelectedAnnotation: (selectedAnnotationIndex: number | null) => {
    set((state) => ({
      ui: { ...state.ui, selectedAnnotationIndex },
    }));
  },

  setActivePanel: (activePanel: 'timeline' | 'whiteboard' | 'inspector') => {
    set((state) => ({
      ui: { ...state.ui, activePanel },
    }));
  },

  setError: (error: string | null) => {
    set((state) => ({
      ui: { ...state.ui, error },
    }));
  },

  // Lifecycle
  reset: () => {
    set(initialState);
  },
}));
