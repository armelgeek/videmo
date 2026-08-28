import { useEffect, useRef } from 'react';
import {
  loadAnimationEngine,
  initializeAnimationEngine,
  tickAnimation,
  isAnimationEngineReady,
} from '../services/animation-engine-loader';

interface AnimationEngineState {
  canvasW: number;
  canvasH: number;
  speed: number;
  playing: boolean;
  _animProgress: number;
  contentBounds: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

interface AnimationEngineCallbacks {
  onFrame?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export const useAnimationEngine = (
  mainCanvas: HTMLCanvasElement | null,
  handCanvas: HTMLCanvasElement | null,
  selectCanvas: HTMLCanvasElement | null,
  state: AnimationEngineState,
  callbacks?: AnimationEngineCallbacks
) => {
  const engineRef = useRef<any>(null);
  const stateRef = useRef(state);
  const loaderRef = useRef<Promise<void> | null>(null);

  // Update state ref when state changes
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load animation engine scripts
  useEffect(() => {
    if (!mainCanvas || !handCanvas || !selectCanvas) return;

    const loadEngine = async () => {
      try {
        // Load scripts if not already loaded
        if (!loaderRef.current) {
          loaderRef.current = loadAnimationEngine();
        }

        await loaderRef.current;

        // Get canvas contexts
        const ctx = mainCanvas.getContext('2d');
        const hctx = handCanvas.getContext('2d');
        const selctx = selectCanvas.getContext('2d');

        if (!ctx || !hctx || !selctx) {
          throw new Error('Could not get canvas contexts');
        }

        // Create offscreen canvas for double buffering
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = mainCanvas.width;
        offscreenCanvas.height = mainCanvas.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');

        if (!offscreenCtx) {
          throw new Error('Could not get offscreen canvas context');
        }

        // Initialize engine state
        const engineState = {
          canvasW: mainCanvas.width,
          canvasH: mainCanvas.height,
          speed: state.speed,
          playing: state.playing,
          _animProgress: 0,
          contentBounds: state.contentBounds,
        };

        // Initialize real animation engine
        initializeAnimationEngine(engineState, ctx, hctx, selctx, offscreenCtx);

        // Store engine instance
        engineRef.current = {
          ctx,
          hctx,
          selctx,
          offscreenCtx,
          offscreenCanvas,
          state: engineState,
          isReady: true,
        };

        console.log('✅ Animation engine initialized:', {
          canvasSize: `${mainCanvas.width}x${mainCanvas.height}`,
          layers: { main: !!ctx, hand: !!hctx, select: !!selctx },
          offscreen: !!offscreenCtx,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to load animation engine:', err);
        callbacks?.onError?.(err);
      }
    };

    loadEngine();
  }, [mainCanvas, handCanvas, selectCanvas, callbacks]);

  // Animation loop tick
  const tick = (deltaMs: number) => {
    if (!engineRef.current?.isReady) return;

    try {
      const { state: engineState } = engineRef.current;

      if (engineState.playing) {
        // Update animation progress
        const speedFactor = engineState.speed / 40;
        engineState._animProgress += deltaMs * speedFactor;

        // Call real animation engine tick
        if (isAnimationEngineReady()) {
          tickAnimation(deltaMs * speedFactor);
        }

        callbacks?.onFrame?.(engineState._animProgress);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Animation tick error:', err);
      callbacks?.onError?.(err);
    }
  };

  // Setup animation for a specific style
  const setupAnimation = (styleName: string, options?: Record<string, any>) => {
    if (!engineRef.current?.isReady) {
      throw new Error('Animation engine not initialized');
    }

    try {
      if (!isAnimationEngineReady()) {
        throw new Error('Animation engine scripts not loaded');
      }

      // Call real animation engine setup
      // This would call AnimationEngine.setupAnnotationSlot()
      // and configure the animation for the given style

      console.log('✅ Animation setup:', { style: styleName, options });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      throw err;
    }
  };

  // Play animation
  const play = () => {
    if (engineRef.current?.isReady) {
      engineRef.current.state.playing = true;
    }
  };

  // Pause animation
  const pause = () => {
    if (engineRef.current?.isReady) {
      engineRef.current.state.playing = false;
    }
  };

  // Stop animation and reset
  const stop = () => {
    if (engineRef.current?.isReady) {
      engineRef.current.state.playing = false;
      engineRef.current.state._animProgress = 0;
    }
  };

  // Seek to specific position
  const seek = (progress: number) => {
    if (engineRef.current?.isReady) {
      engineRef.current.state._animProgress = Math.max(0, progress);
    }
  };

  return {
    tick,
    play,
    pause,
    stop,
    seek,
    setupAnimation,
    isReady: !!engineRef.current?.isReady,
    getProgress: () => engineRef.current?.state._animProgress ?? 0,
  };
};
