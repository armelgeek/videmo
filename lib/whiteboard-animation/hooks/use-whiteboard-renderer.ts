'use client';

import { useEffect, useRef, useState } from 'react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import {
  SCENE_PREMIUM_BAG_ANNOTATIONS,
  projectAnnotations,
} from '../data/scene-premium-bag';
import { deriveTimeline } from '../timeline/derive-timeline';
import { normalizeGaps } from '../timeline/normalize-gaps';
import { useDerivedAnnotations } from '../timeline/use-derived-annotations';

const AnimationFactory = require('../lib/index');
const { CUSTOM_HANDS } = require('../lib/hands');
const { handDrawRect } = require('../lib/handLayout');

const SCENE_IMAGE = '/scene-premium-bag.png';

const HAND_ASSETS: Record<string, string> = {
  custom1: '/images/hand1-720p.png',
  custom2: '/images/hand2-720p.png',
  custom3: '/images/hand3-720p.png',
  custom4: '/images/hand4-720p.png',
};

/** Accepts "hand1", "Hand 1", "custom1"… and returns a CUSTOM_HANDS key. */
function normalizeHandKey(handStyle: string): string {
  const s = (handStyle || '').toLowerCase().replace(/\s+/g, '');
  for (const n of ['1', '2', '3', '4']) {
    if (s.includes(`hand${n}`) || s === `custom${n}`) return `custom${n}`;
  }
  return 'custom1';
}

export interface UseWhiteboardRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  handCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  annotationCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export function useWhiteboardRenderer({
  canvasRef,
  handCanvasRef,
  annotationCanvasRef,
}: UseWhiteboardRendererProps) {
  const {
    progress,
    isPlaying,
    currentTime,
    canvasBg,
    useAnnotation,
    animStyle,
    handStyle,
    revealSpeed,
    handSpeed,
    chunks,
  } = useUnifiedEngine();

  const { annotations } = useDerivedAnnotations();

  const imageRef = useRef<HTMLImageElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const handImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const animRef = useRef<any>(null);
  const activeStyleRef = useRef<string>('');
  // Guards the engine callbacks. Held in a ref, not a per-run closure: the
  // instance outlives a run (pause/resume, StrictMode remount) and a stale
  // closure flag would silently disable its callbacks forever.
  const stoppedRef = useRef(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Latest config, readable from inside the rAF closure without re-subscribing.
  const cfgRef = useRef({ handStyle, revealSpeed, canvasBg });
  cfgRef.current = { handStyle, revealSpeed, canvasBg };

  // ---- assets -------------------------------------------------------------

  useEffect(() => {
    const img = new Image();
    img.src = SCENE_IMAGE;
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => console.error('Failed to load scene image', SCENE_IMAGE);

    Object.entries(HAND_ASSETS).forEach(([key, src]) => {
      const h = new Image();
      h.src = src;
      h.onload = () => {
        handImagesRef.current[key] = h;
      };
    });
  }, []);

  // Seed the demo scene once: annotations projected onto the canvas + duration.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    seededRef.current = true;

    const store = useUnifiedEngineStore.getState();
    if (store.animation.annotations.length === 0) {
      // normalizeGaps turns the authored absolute startMs into the derived
      // model (order + duration + gap) the timeline editor works with.
      normalizeGaps(
        projectAnnotations(
          SCENE_PREMIUM_BAG_ANNOTATIONS,
          canvas.width,
          canvas.height
        )
      ).forEach((a) => store.addAnnotation(a));
    }
  }, [canvasRef]);

  // ---- helpers ------------------------------------------------------------

  const paintBackground = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const bg = cfgRef.current.canvasBg;
    if (bg === 'none') return;
    ctx.fillStyle = bg === 'black' ? '#111111' : bg?.startsWith('#') ? bg : '#ffffff';
    ctx.fillRect(0, 0, w, h);
  };

  const drawHandSprite = (tipX: number, tipY: number) => {
    const handCanvas = handCanvasRef.current;
    if (!handCanvas) return;
    const hctx = handCanvas.getContext('2d');
    if (!hctx) return;

    hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    if (cfgRef.current.handStyle === 'ghost') return;

    const key = normalizeHandKey(cfgRef.current.handStyle);
    const imgConfig = CUSTOM_HANDS[key]?.images?.[720];
    const sprite = handImagesRef.current[key] ?? handImagesRef.current.custom1;

    if (imgConfig && sprite?.complete) {
      const r = handDrawRect(
        imgConfig,
        720,
        tipX,
        tipY,
        handCanvas.width,
        handCanvas.height
      );
      hctx.drawImage(sprite, r.x, r.y, r.width, r.height);
    }
  };

  // Static preview when idle: the finished drawing, no engine involved.
  const drawStaticPreview = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintBackground(ctx, canvas.width, canvas.height);
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    }
  };

  // ---- engine-driven playback --------------------------------------------

  // Changing what the engine was built from invalidates the instance, so the
  // next play rebuilds it. Reveal speed is read live in tick(), so it is absent.
  useEffect(() => {
    console.log('[WB] invalidate', { animStyle, handStyle, handSpeed, chunks, useAnnotation });
    animRef.current = null;
  }, [animStyle, handStyle, handSpeed, chunks, useAnnotation]);

  useEffect(() => {
    // Pausing must freeze the frame: keep the instance and the painted canvas
    // so resuming continues instead of restarting.
    if (!isPlaying) return;

    const canvas = canvasRef.current;
    const handCanvas = handCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const hctx = handCanvas?.getContext('2d');
    if (!canvas || !handCanvas || !ctx || !hctx || !imageRef.current) return;

    // Resume path: the engine already holds its progress, just keep ticking.
    if (animRef.current) {
      stoppedRef.current = false;
      let resumeFrame = 0;
      let resumeLast = performance.now();

      const resumeStep = (now: number) => {
        if (stoppedRef.current) return;
        const delta = Math.min(100, now - resumeLast);
        resumeLast = now;
        animRef.current?.tick?.(cfgRef.current.revealSpeed, delta);
        if (!stoppedRef.current) resumeFrame = requestAnimationFrame(resumeStep);
      };
      resumeFrame = requestAnimationFrame(resumeStep);

      return () => {
        stoppedRef.current = true;
        cancelAnimationFrame(resumeFrame);
      };
    }

    // Offscreen holds the source artwork the engine reveals from.
    let offscreen = offscreenRef.current;
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      offscreenRef.current = offscreen;
    }
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    offscreen
      .getContext('2d')
      ?.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintBackground(ctx, canvas.width, canvas.height);

    stoppedRef.current = false;
    let frame = 0;

    const store = useUnifiedEngineStore.getState();
    const engineState: any = {
      canvasW: canvas.width,
      canvasH: canvas.height,
      speed: revealSpeed,
      handSpeed,
      hand: normalizeHandKey(handStyle),
      tileSlider: chunks,
      contentBounds: { x: 0, y: 0, w: canvas.width, h: canvas.height },
      annotations: useAnnotation
        ? deriveTimeline(store.animation.annotations).annotations
        : [],
    };

    try {
      animRef.current = AnimationFactory.create(animStyle, {
        state: engineState,
        ctx,
        hctx,
        offscreen,
        callbacks: {
          fillBg: () => paintBackground(ctx, canvas.width, canvas.height),
          drawHand: (...args: any[]) => {
            if (stoppedRef.current) return;
            // Styles call drawHand(x, y) or drawHand(ctx, x, y).
            const [a, b, c] = args;
            const tipX = typeof a === 'number' ? a : b;
            const tipY = typeof a === 'number' ? b : c;
            if (typeof tipX === 'number' && typeof tipY === 'number') {
              drawHandSprite(tipX, tipY);
            }
          },
          setProgress: (p: number) => {
            if (stoppedRef.current) return;
            const s = useUnifiedEngineStore.getState();
            s.setCurrentTime(Math.min(1, Math.max(0, p)) * s.timeline.duration);
          },
          finishAnim: () => {
            stoppedRef.current = true;
            cancelAnimationFrame(frame);
            animRef.current = null;
            const s = useUnifiedEngineStore.getState();
            s.setCurrentTime(s.timeline.duration);
            s.setIsPlaying(false);
            hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
          },
          resScale: () => 1,
          resPointScale: () => 1,
        },
      });

      animRef.current.setup?.();
      activeStyleRef.current = animStyle;
      console.log('[WB] built engine', animStyle);
    } catch (err) {
      console.error('Failed to start animation engine:', err);
      useUnifiedEngineStore.getState().setIsPlaying(false);
      return;
    }

    let last = performance.now();
    const step = (now: number) => {
      if (stoppedRef.current) return;
      const delta = Math.min(100, now - last);
      last = now;
      if (!animRef.current) console.log('[WB] tick skipped: instance gone');
      animRef.current?.tick?.(cfgRef.current.revealSpeed, delta);
      if (!stoppedRef.current) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    // Keep animRef so a pause can resume; only cancel the frame loop.
    return () => {
      stoppedRef.current = true;
      cancelAnimationFrame(frame);
    };
  }, [isPlaying, imageLoaded]);

  // Static preview only at the very start (or after Reset). Pausing mid-run
  // must leave the engine's partial frame on screen.
  useEffect(() => {
    if (isPlaying || currentTime > 0) return;
    animRef.current = null;
    const handCanvas = handCanvasRef.current;
    handCanvas
      ?.getContext('2d')
      ?.clearRect(0, 0, handCanvas.width, handCanvas.height);
    drawStaticPreview();
  }, [isPlaying, currentTime, imageLoaded, canvasBg, canvasRef, handCanvasRef]);

  // ---- annotation overlay -------------------------------------------------

  useEffect(() => {
    const annCanvas = annotationCanvasRef?.current;
    if (!annCanvas) return;

    const actx = annCanvas.getContext('2d');
    if (!actx) return;

    actx.clearRect(0, 0, annCanvas.width, annCanvas.height);
    if (!useAnnotation || annotations.length === 0) return;

    // Idle shows every region; during playback each appears at its reveal time.
    const idle = !isPlaying && currentTime === 0;

    annotations.forEach((annot, i) => {
      const region = annot.region;
      if (!region) return;
      if (!idle && currentTime < (annot.reveal?.from ?? 0)) return;

      const stroke = annot.style?.strokeColor ?? '#2563eb';
      const fill = annot.style?.fillColor ?? 'rgba(37, 99, 235, 0.12)';

      actx.fillStyle = fill;
      actx.fillRect(region.x, region.y, region.width, region.height);

      actx.strokeStyle = stroke;
      actx.lineWidth = annot.style?.strokeWidth ?? 2;
      actx.strokeRect(region.x, region.y, region.width, region.height);

      const label = `${i + 1}. ${annot.text}`;
      actx.font = 'bold 14px Geist, sans-serif';
      const textWidth = actx.measureText(label).width;
      const badgeY = Math.max(0, region.y - 22);

      actx.fillStyle = stroke;
      actx.fillRect(region.x, badgeY, textWidth + 12, 22);

      actx.fillStyle = '#ffffff';
      actx.fillText(label, region.x + 6, badgeY + 16);
    });
  }, [useAnnotation, annotations, annotationCanvasRef, currentTime, isPlaying]);
}
