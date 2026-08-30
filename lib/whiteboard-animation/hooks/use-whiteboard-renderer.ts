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

/** Miroir de Animation.DEFAULT_SPEED : le 1x du curseur Reveal speed. */
const ENGINE_DEFAULT_SPEED = 40;

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
  // Vrai pendant qu'on rejoue le moteur pour atteindre une position cherchee :
  // les callbacks ne doivent alors rien ecrire dans le store, sinon le seek se
  // battrait avec la valeur que l'utilisateur vient de poser.
  const seekingRef = useRef(false);
  // Dernier currentTime ECRIT par le moteur. Sert a distinguer un seek de
  // l'utilisateur d'une simple progression de lecture.
  const engineTimeRef = useRef(0);
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
    animRef.current = null;
  }, [animStyle, handStyle, handSpeed, chunks, useAnnotation]);

  // Offscreen holds the source artwork the engine reveals from.
  const ensureOffscreen = (canvas: HTMLCanvasElement) => {
    let offscreen = offscreenRef.current;
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      offscreenRef.current = offscreen;
    }
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    offscreen
      .getContext('2d')
      ?.drawImage(imageRef.current!, 0, 0, canvas.width, canvas.height);
    return offscreen;
  };

  /**
   * Build a fresh engine bound to these contexts. Shared by playback and seek:
   * a seek is just a run replayed at a fixed step, so it must be built exactly
   * like the real thing or the frame it lands on would not match.
   */
  const buildEngine = (
    canvas: HTMLCanvasElement,
    handCanvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    hctx: CanvasRenderingContext2D,
    offscreen: HTMLCanvasElement
  ) => {
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

    const anim = AnimationFactory.create(animStyle, {
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
          if (stoppedRef.current || seekingRef.current) return;
          const s = useUnifiedEngineStore.getState();
          const ms = Math.min(1, Math.max(0, p)) * s.timeline.duration;
          engineTimeRef.current = ms;
          s.setCurrentTime(ms);
        },
        finishAnim: () => {
          stoppedRef.current = true;
          if (seekingRef.current) {
            hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
            return;
          }
          animRef.current = null;
          const s = useUnifiedEngineStore.getState();
          engineTimeRef.current = s.timeline.duration;
          s.setCurrentTime(s.timeline.duration);
          s.setIsPlaying(false);
          hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
        },
        resScale: () => 1,
        resPointScale: () => 1,
      },
    });

    anim.setup?.();
    activeStyleRef.current = animStyle;
    return anim;
  };

  useEffect(() => {
    // Pausing must freeze the frame: keep the instance and the painted canvas
    // so resuming continues instead of restarting.
    if (!isPlaying) return;

    const canvas = canvasRef.current;
    const handCanvas = handCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const hctx = handCanvas?.getContext('2d');
    if (!canvas || !handCanvas || !ctx || !hctx || !imageRef.current) return;

    let frame = 0;

    // Resume path: the engine already holds its progress (pause, or a seek that
    // just replayed one), so keep ticking instead of rebuilding.
    if (!animRef.current) {
      const offscreen = ensureOffscreen(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paintBackground(ctx, canvas.width, canvas.height);
      stoppedRef.current = false;
      try {
        animRef.current = buildEngine(canvas, handCanvas, ctx, hctx, offscreen);
      } catch (err) {
        console.error('Failed to start animation engine:', err);
        useUnifiedEngineStore.getState().setIsPlaying(false);
        return;
      }
    }

    stoppedRef.current = false;
    let last = performance.now();
    const step = (now: number) => {
      if (stoppedRef.current) return;
      const delta = Math.min(100, now - last);
      last = now;
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

  // ---- seek ---------------------------------------------------------------

  // Pas fixe utilise pour rejouer le moteur jusqu'a la position cherchee. La
  // cadence des styles est pilotee par le temps ecoule et non par un nombre de
  // frames, donc un pas grossier tombe sur la meme image que la lecture reelle.
  const SEEK_STEP_MS = 33.34;

  /** Rect d'une region, borne au canvas — meme calcul que _enterRegion. */
  const regionRect = (r: any, canvas: HTMLCanvasElement) => {
    const x = Math.max(0, Math.floor(r.x));
    const y = Math.max(0, Math.floor(r.y));
    const x2 = Math.min(canvas.width, Math.ceil(r.x + r.width));
    const y2 = Math.min(canvas.height, Math.ceil(r.y + r.height));
    return x2 <= x || y2 <= y ? null : { x, y, w: x2 - x, h: y2 - y };
  };

  // Scrub de la timeline. Sans cela currentTime n'est qu'une SORTIE du moteur :
  // rien ne repeignait, et se placer a 0:00.4 laissait le dessin termine a
  // l'ecran.
  //
  // L'image a la FRONTIERE d'une annotation est connue en forme close : le
  // moteur tamponne chaque region en entier avant de passer a la suivante, donc
  // c'est le fond plus les regions precedentes tamponnees. On la peint
  // directement au lieu de la mettre en cache, puis on n'anime que la region
  // courante. Le rejeu est ainsi borne par la duree d'UNE region au lieu de
  // croitre avec la position cherchee.
  useEffect(() => {
    if (isPlaying || !imageLoaded) return;
    // t = 0 est deja rendu par l'apercu statique.
    if (currentTime <= 0) return;
    // Ecriture du moteur lui-meme (progression, fin de lecture) : rien a faire.
    if (Math.abs(currentTime - engineTimeRef.current) < 1) return;

    const canvas = canvasRef.current;
    const handCanvas = handCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const hctx = handCanvas?.getContext('2d');
    if (!canvas || !handCanvas || !ctx || !hctx || !imageRef.current) return;

    // Un drag emet un flot de seeks : on n'en rejoue qu'un par frame.
    const raf = requestAnimationFrame(() => {
      const offscreen = ensureOffscreen(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paintBackground(ctx, canvas.width, canvas.height);
      hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);

      stoppedRef.current = false;
      seekingRef.current = true;
      try {
        const anim = buildEngine(canvas, handCanvas, ctx, hctx, offscreen);
        const schedule = anim.annotationManager?.schedule;

        // L'horloge du moteur avance de delta * (revealSpeed / DEFAULT_SPEED) :
        // on divise le pas par ce facteur pour tomber exactement sur la ms
        // demandee quel que soit le curseur de vitesse.
        const timeScale = Math.max(
          0.05,
          (cfgRef.current.revealSpeed || ENGINE_DEFAULT_SPEED) / ENGINE_DEFAULT_SPEED
        );
        const advance = (from: number, to: number) => {
          for (let elapsed = from; elapsed < to; elapsed += SEEK_STEP_MS) {
            if (stoppedRef.current) break;
            const slice = Math.min(SEEK_STEP_MS, to - elapsed);
            anim.tick?.(cfgRef.current.revealSpeed, slice / timeScale);
          }
        };

        if (!schedule || schedule.length === 0) {
          // Pas d'annotations : le style s'anime d'un bloc, seul un rejeu
          // depuis le debut donne la bonne image.
          advance(0, currentTime);
        } else {
          // Premiere region non terminee a cet instant.
          const idx = schedule.findIndex((s: any) => currentTime < s.endMs);

          if (idx === -1) {
            // Apres la derniere region : le moteur tamponne toute l'image en
            // terminant, y compris ce qu'aucune region ne couvre.
            ctx.drawImage(imageRef.current!, 0, 0, canvas.width, canvas.height);
          } else {
            for (let i = 0; i < idx; i++) {
              const rect = regionRect(schedule[i].annot.region, canvas);
              if (rect) {
                ctx.drawImage(
                  offscreen,
                  rect.x, rect.y, rect.w, rect.h,
                  rect.x, rect.y, rect.w, rect.h
                );
              }
            }

            const entry = schedule[idx];
            if (currentTime >= entry.startMs) {
              // Dans la region : on repart de sa frontiere, deja peinte.
              anim.primeAt?.(entry.startMs);
              advance(entry.startMs, currentTime);
            } else {
              // Dans une pause entre deux annotations : rien de plus a tracer,
              // et la main n'a pas a rester figee sur le dernier trait.
              anim.primeAt?.(currentTime);
            }
          }
        }

        // finishAnim() a pu s'armer si on cherche la toute fin : dans ce cas
        // l'instance est consommee, un Play repartira du debut.
        animRef.current = stoppedRef.current ? null : anim;
      } catch (err) {
        console.error('Failed to seek animation engine:', err);
      } finally {
        seekingRef.current = false;
        stoppedRef.current = false;
      }

      engineTimeRef.current = currentTime;
    });

    return () => cancelAnimationFrame(raf);
  }, [currentTime, isPlaying, imageLoaded]);

  // Static preview only at the very start (or after Reset). Pausing mid-run
  // must leave the engine's partial frame on screen.
  useEffect(() => {
    if (isPlaying || currentTime > 0) return;
    animRef.current = null;
    engineTimeRef.current = 0;
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
