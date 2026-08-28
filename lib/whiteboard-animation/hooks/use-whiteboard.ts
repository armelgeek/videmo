import { useState, useCallback, useEffect } from 'react';
import type { WhiteboardState, WhiteboardLayer, AnimationStyle, AnimationOptions } from '../types';

export interface UseWhiteboardProps {
  initialWidth?: number;
  initialHeight?: number;
  initialStyle?: AnimationStyle;
  autoSave?: boolean;
}

export const defaultWhiteboardState: WhiteboardState = {
  canvasWidth: 1280,
  canvasHeight: 720,
  animationStyle: 'scanner',
  animationOptions: {
    lineColor: '#000000',
    lineWidth: 2,
    speed: 1,
  },
  layers: [],
  speed: 1,
  playing: false,
  currentTime: 0,
  duration: 5000,
};

export function useWhiteboard(props?: UseWhiteboardProps) {
  const [state, setState] = useState<WhiteboardState>({
    ...defaultWhiteboardState,
    canvasWidth: props?.initialWidth || 1280,
    canvasHeight: props?.initialHeight || 720,
    animationStyle: props?.initialStyle || 'scanner',
  });

  // Auto-save to localStorage
  useEffect(() => {
    if (!props?.autoSave) return;

    const timer = setTimeout(() => {
      localStorage.setItem('whiteboard-state', JSON.stringify(state));
    }, 1000);

    return () => clearTimeout(timer);
  }, [state, props?.autoSave]);

  // Load from localStorage on mount
  useEffect(() => {
    if (!props?.autoSave) return;

    const saved = localStorage.getItem('whiteboard-state');
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {
        // Silently fail if parsing fails
      }
    }
  }, [props?.autoSave]);

  const updateState = useCallback((updates: Partial<WhiteboardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const addLayer = useCallback((layer: WhiteboardLayer) => {
    setState((prev) => ({
      ...prev,
      layers: [...prev.layers, layer],
    }));
  }, []);

  const removeLayer = useCallback((layerId: string) => {
    setState((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== layerId),
    }));
  }, []);

  const updateLayer = useCallback(
    (layerId: string, updates: Partial<WhiteboardLayer>) => {
      setState((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === layerId ? { ...l, ...updates } : l
        ),
      }));
    },
    []
  );

  const setSelectedLayer = useCallback((layerId: string | undefined) => {
    setState((prev) => ({
      ...prev,
      selectedLayerId: layerId,
    }));
  }, []);

  const play = useCallback(() => {
    setState((prev) => ({ ...prev, playing: true }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, playing: false }));
  }, []);

  const stop = useCallback(() => {
    setState((prev) => ({ ...prev, playing: false, currentTime: 0 }));
  }, []);

  const seek = useCallback((time: number) => {
    setState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  const reset = useCallback(() => {
    setState(defaultWhiteboardState);
  }, []);

  const setAnimationStyle = useCallback((style: AnimationStyle) => {
    setState((prev) => ({ ...prev, animationStyle: style }));
  }, []);

  const setAnimationOptions = useCallback((options: Partial<AnimationOptions>) => {
    setState((prev) => ({
      ...prev,
      animationOptions: { ...prev.animationOptions, ...options },
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  return {
    state,
    updateState,
    addLayer,
    removeLayer,
    updateLayer,
    setSelectedLayer,
    play,
    pause,
    stop,
    seek,
    reset,
    setAnimationStyle,
    setAnimationOptions,
    setSpeed,
  };
}
