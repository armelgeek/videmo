import { deriveTimeline } from '@/lib/whiteboard-animation/timeline/derive-timeline';
import type { UnifiedEngineState } from '../types';

// Import legacy animation libs
const AnimationFactory = require('@/lib/whiteboard-animation/lib/index');
const { CUSTOM_HANDS } = require('@/lib/whiteboard-animation/lib/hands');
const { handDrawRect } = require('@/lib/whiteboard-animation/lib/handLayout');

/**
 * The engine's 1x (Animation.DEFAULT_SPEED). At this value each annotation's
 * durationMs is honoured exactly and the output matches the reference engine.
 *
 * The engine clock is deliberately fixed here rather than wired to a setting:
 * the reveal.from/to bounds are NARRATION timestamps, so any multiplier would
 * make the drawing drift away from its soundtrack.
 */
const FAITHFUL_1X = 40;

export interface AnimationEngineConfig {
  state: UnifiedEngineState;
  ctx: CanvasRenderingContext2D;
  hctx: CanvasRenderingContext2D;
  offscreen: HTMLCanvasElement;
  callbacks?: {
    fillBg?: () => void;
    drawHand?: (tipX: number, tipY: number) => void;
    setProgress?: (progress: number) => void;
    finishAnim?: () => void;
    resScale?: () => number;
    resPointScale?: () => number;
  };
}

export class AnimationEngine {
  private legacyInstance: any = null;
  private currentStyle: string = '';

  create(style: string, config: AnimationEngineConfig) {
    this.currentStyle = style;

    const engineState = {
      canvasW: config.state.canvas.width,
      canvasH: config.state.canvas.height,
      speed: FAITHFUL_1X,
      handSpeed: config.state.animation.handSpeed,
      hand: config.state.animation.handStyle,
      tileSlider: config.state.animation.chunks,
      contentBounds: {
        x: config.state.animation.layers[0]?.x ?? 0,
        y: config.state.animation.layers[0]?.y ?? 0,
        w: config.state.animation.layers[0]?.w ?? config.state.canvas.width,
        h: config.state.animation.layers[0]?.h ?? config.state.canvas.height,
      },
      annotations: config.state.animation.useAnnotation
        ? deriveTimeline(config.state.animation.annotations).annotations
        : [],
    };

    try {
      this.legacyInstance = AnimationFactory.create(style, {
        state: engineState,
        ctx: config.ctx,
        hctx: config.hctx,
        offscreen: config.offscreen,
        callbacks: config.callbacks || {},
      });

      return this.legacyInstance;
    } catch (err) {
      console.error('Error creating animation instance:', err);
      throw err;
    }
  }

  tick(speed: number, deltaMs: number) {
    if (this.legacyInstance && this.legacyInstance.tick) {
      this.legacyInstance.tick(speed, deltaMs);
    }
  }

  setup() {
    if (this.legacyInstance && this.legacyInstance.setup) {
      this.legacyInstance.setup();
    }
  }

  destroy() {
    this.legacyInstance = null;
    this.currentStyle = '';
  }
}

export { CUSTOM_HANDS, handDrawRect };
