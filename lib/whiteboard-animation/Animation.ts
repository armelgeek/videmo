/**
 * Base Animation class for shared animation logic.
 * Works in both browser (canvas context) and Node (simulated canvas via puppeteer).
 * Supports annotation-based timing and region filtering.
 */

import type { AnnotationManager as AnnotationManagerType } from './AnnotationManager';

interface AnimationState {
  _fullContentBounds?: any;
  contentBounds: { x: number; y: number; w: number; h: number };
  _lastAnnotationIdx?: number;
  _annotationChanged?: boolean;
  _regionRect?: any;
  annotations?: any[];
  revealCanvas?: HTMLCanvasElement;
  canvasW: number;
  canvasH: number;
  [key: string]: any;
}

interface AnimationCallbacks {
  fillBg?: () => void;
  drawHand?: () => void;
  setProgress?: (progress: number) => void;
  finishAnim?: () => void;
  resScale?: () => number;
  resPointScale?: () => number;
}

interface AnimationConfig {
  state: AnimationState;
  ctx: CanvasRenderingContext2D;
  hctx: CanvasRenderingContext2D;
  offscreen: HTMLCanvasElement;
  callbacks?: AnimationCallbacks;
}

export class Animation {
  static readonly DEFAULT_SPEED = 40;

  protected state: AnimationState;
  protected ctx: CanvasRenderingContext2D;
  protected hctx: CanvasRenderingContext2D;
  protected offscreen: HTMLCanvasElement;
  protected fillBg: () => void;
  protected drawHand: () => void;
  protected setProgress: (progress: number) => void;
  protected finishAnim: () => void;
  protected resScale: () => number;
  protected resPointScale: () => number;
  protected annotationManager?: any;

  constructor(config: AnimationConfig) {
    this.state = config.state;
    this.ctx = config.ctx;
    this.hctx = config.hctx;
    this.offscreen = config.offscreen;

    const callbacks = config.callbacks || {};
    this.fillBg = callbacks.fillBg || (() => {});
    this.drawHand = callbacks.drawHand || (() => {});
    this.setProgress = callbacks.setProgress || (() => {});
    this.finishAnim = callbacks.finishAnim || (() => {});
    this.resScale = callbacks.resScale || (() => 1);
    this.resPointScale = callbacks.resPointScale || (() => 1);

    if (this.state._fullContentBounds) {
      this.state.contentBounds = this.state._fullContentBounds;
      this.state._fullContentBounds = null;
    }
    this.state._lastAnnotationIdx = undefined;
    this.state._annotationChanged = false;
    this.state._regionRect = null;

    if (this.state.annotations && this.state.annotations.length > 0) {
      // Import here to avoid circular dependency
      try {
        // eslint-disable-next-line global-require
        const AnnotationManagerModule = require('./AnnotationManager');
        const AnnotationManager = AnnotationManagerModule.default || AnnotationManagerModule;
        this.annotationManager = new AnnotationManager(this.state, this.offscreen);
      } catch {
        console.warn('AnnotationManager not available');
      }
    }
  }

  setup(): void {
    // Override in subclasses
  }

  tick(_speed: number): void {
    // Override in subclasses
  }

  buildPresenceMap(): Uint8Array {
    const cb = this.state.contentBounds;
    const W = cb.w;
    const H = cb.h;
    const ctx = this.offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Cannot get canvas context');

    const imgData = ctx.getImageData(cb.x, cb.y, W, H);
    const d = imgData.data;
    const map = new Uint8Array(W * H);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const a = d[i + 3];
        if (a > 20 && (a < 250 || d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240)) {
          map[y * W + x] = 1;
        }
      }
    }
    return map;
  }

  ensureRevealCanvas(): void {
    if (!this.state.revealCanvas) {
      this.state.revealCanvas = document.createElement('canvas');
      this.state.revealCanvas.width = this.state.canvasW;
      this.state.revealCanvas.height = this.state.canvasH;
      const ctx = this.state.revealCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      }
    }
  }

  getActiveAnnotations(deltaMs: number = 16.67): any[] {
    if (!this.annotationManager) return [];
    this.annotationManager.elapsedMs += deltaMs;
    return this.annotationManager.tick(0);
  }

  protected withAnnotationAwareness(
    deltaMs: number,
    callback: (annot: any, bounds: any, paceSpeed: number) => void
  ): void {
    if (!this.annotationManager) {
      callback(null, this.state.contentBounds, 0);
      return;
    }

    const annotations = this.getActiveAnnotations(deltaMs);
    for (const annot of annotations) {
      const bounds = annot.regionRect || this.state.contentBounds;
      const paceSpeed = annot.durationMs ? bounds.w / annot.durationMs : 0;
      callback(annot, bounds, paceSpeed);
    }
  }
}

export default Animation;
