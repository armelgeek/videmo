'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useStoryboardStore } from '@/lib/storyboard/store';
import type { Annotation } from '../schema';

// Import AnnotationManager from lib
const AnnotationManager = require('../lib/AnnotationManager');

export interface AnnotationManagerState {
  activeAnnotations: Array<{
    idx: number;
    annot: Annotation;
    startMs: number;
    durationMs: number;
    progress: number;
  }>;
  isFinished: boolean;
  progress: number;
  endMs: number;
}

export function useAnnotationManager(elapsedMs: number = 0) {
  const whiteboardConfig = useStoryboardStore((state) => state.whiteboardConfig);
  const managerRef = useRef<any>(null);

  // Create or update AnnotationManager instance
  const manager = useMemo(() => {
    if (!whiteboardConfig.annotations || whiteboardConfig.annotations.length === 0) {
      return null;
    }

    const m = new AnnotationManager({
      annotations: whiteboardConfig.annotations,
      departMs: 0,
    });

    managerRef.current = m;
    return m;
  }, [whiteboardConfig.annotations]);

  // Get active annotations at current time
  const getActiveAnnotations = (ms: number) => {
    if (!manager) return [];
    return manager.tick(ms);
  };

  // Get annotation state at specific time
  const getAnnotationState = (ms: number): AnnotationManagerState => {
    if (!manager) {
      return {
        activeAnnotations: [],
        isFinished: true,
        progress: 0,
        endMs: 0,
      };
    }

    const active = manager.tick(ms);
    const endMs = manager.endMs();
    const progress = endMs > 0 ? Math.min(1, ms / endMs) : 0;

    return {
      activeAnnotations: active,
      isFinished: ms >= endMs,
      progress,
      endMs,
    };
  };

  // Advance to specific time
  const advanceTo = (ms: number) => {
    if (manager) {
      manager.elapsedMs = ms;
      return manager.tick(0);
    }
    return [];
  };

  // Get timeline duration
  const getDuration = () => {
    if (!manager) return 0;
    return manager.endMs();
  };

  // Check if annotations have conflicts
  const hasConflicts = () => {
    if (!manager) return false;
    return manager.conflits && manager.conflits.length > 0;
  };

  // Get conflict information
  const getConflicts = () => {
    if (!manager) return [];
    return manager.conflits || [];
  };

  return {
    manager,
    getActiveAnnotations,
    getAnnotationState,
    advanceTo,
    getDuration,
    hasConflicts,
    getConflicts,
  };
}
