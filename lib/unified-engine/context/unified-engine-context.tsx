'use client';

import { create } from 'zustand';
import type { UnifiedEngineStore, UnifiedEngineState, Annotation, InkplainerLayer } from '../types';
import { belongsToScene } from '../hooks/selectors';

/** Les positions, dans le tableau de toutes les scenes, des annotations d'une scene. */
function indicesDeScene(annotations: Annotation[], panelId: string | null): number[] {
  const out: number[] = [];
  annotations.forEach((a, i) => {
    if (belongsToScene(a, panelId)) out.push(i);
  });
  return out;
}

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
    activeScenePanelId: null,
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
  //
  // Le tableau porte TOUTES les scenes. Les index recus ici sont locaux a la
  // scene active : ils sont traduits en positions du tableau complet.
  updateAnnotation: (index: number, data: Partial<Annotation>) => {
    set((state) => {
      const panelId = state.ui.activeScenePanelId;
      const flat = indicesDeScene(state.animation.annotations, panelId);
      const target = flat[index];
      if (target === undefined) return state;
      const annotations = [...state.animation.annotations];
      annotations[target] = { ...annotations[target], ...data };
      return { animation: { ...state.animation, annotations } };
    });
  },

  addAnnotation: (annotation: Annotation) => {
    set((state) => {
      const panelId = state.ui.activeScenePanelId;
      const tagged =
        panelId !== null && annotation.panelId === undefined
          ? { ...annotation, panelId }
          : annotation;
      const annotations = [...state.animation.annotations];
      const flat = indicesDeScene(annotations, panelId);
      const after = flat.length > 0 ? flat[flat.length - 1] + 1 : annotations.length;
      annotations.splice(after, 0, tagged);
      return { animation: { ...state.animation, annotations } };
    });
  },

  removeAnnotation: (id: string) => {
    set((state) => {
      const panelId = state.ui.activeScenePanelId;
      const target = state.animation.annotations.findIndex(
        (a) => a.id === id && belongsToScene(a, panelId),
      );
      if (target < 0) return state;
      const annotations = [...state.animation.annotations];
      annotations.splice(target, 1);
      return { animation: { ...state.animation, annotations } };
    });
  },

  // Chargement unique : toutes les scenes d'un coup.
  setAnnotations: (annotations: Annotation[]) => {
    set((state) => ({
      animation: { ...state.animation, annotations },
    }));
  },

  setSceneAnnotations: (panelId: string | null, sceneAnnotations: Annotation[]) => {
    set((state) => {
      if (panelId === null) {
        return { animation: { ...state.animation, annotations: sceneAnnotations } };
      }
      const current = state.animation.annotations;
      const tagged = sceneAnnotations.map((a) =>
        a.panelId === panelId ? a : { ...a, panelId },
      );
      // La scene reprend sa place dans l'ordre des scenes : l'ordre porte le
      // minutage de la sequence globale.
      const first = current.findIndex((a) => a.panelId === panelId);
      const others = current.filter((a) => a.panelId !== panelId);
      const insertAt =
        first < 0
          ? others.length
          : current.slice(0, first).filter((a) => a.panelId !== panelId).length;
      const annotations = [
        ...others.slice(0, insertAt),
        ...tagged,
        ...others.slice(insertAt),
      ];
      return { animation: { ...state.animation, annotations } };
    });
  },

  setActiveScenePanelId: (activeScenePanelId: string | null) => {
    set((state) =>
      state.ui.activeScenePanelId === activeScenePanelId
        ? state
        : { ui: { ...state.ui, activeScenePanelId } },
    );
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
