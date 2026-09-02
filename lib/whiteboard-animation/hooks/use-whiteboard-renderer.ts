'use client';

import { useEffect, useRef, useState } from 'react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import {
  SCENE_PREMIUM_BAG_ANNOTATIONS,
  projectAnnotations,
} from '../data/scene-premium-bag';
import { rectContenu, reprojeterRegion, type RectContenu } from '../canvas-size';
import type { Annotation } from '@/lib/unified-engine/types';
import { deriveTimeline } from '../timeline/derive-timeline';
import { normalizeGaps } from '../timeline/normalize-gaps';
import { useDerivedAnnotations } from '../timeline/use-derived-annotations';
import { DRIFT_MAX_MS } from './audio-delta';
import { useAudioClock } from '../audio/use-audio-clock';

const AnimationFactory = require('../lib/index');
const { CUSTOM_HANDS } = require('../lib/hands');
const { handDrawRect } = require('../lib/handLayout');

const SCENE_IMAGE = '/scene-premium-bag.png';

/**
 * Le 1x du moteur (Animation.DEFAULT_SPEED). A cette valeur la durationMs de
 * chaque annotation est honoree exactement.
 *
 * L'horloge est figee ici plutot que branchee sur un reglage : reveal.from/to
 * sont des timestamps de la NARRATION, donc tout multiplicateur ferait deriver
 * le dessin par rapport a sa bande-son. config.revealSpeed subsiste pour les
 * projets deja enregistres mais n'est plus lu.
 */
const ENGINE_DEFAULT_SPEED = 40;

/**
 * A gap this long is not a slow frame, it is rAF having been parked — a
 * backgrounded tab, a blocked main thread. That time was not animated and
 * must not be replayed as one jump, so it is dropped and the narration
 * realigns instead.
 *
 * Ordinary slow frames are NOT clamped: a frame that really took 300ms
 * consumed 300ms of the video. The old blanket 100ms ceiling silently lost
 * everything past it, which is why a heavy style took ~16s to play 11.2s of
 * timeline (WHITEBOARD_EDITOR_TODO 3.2).
 */
const BIG_GAP_MS = 1000;

/**
 * Minimum spacing between two corrections of the narration. Each one is a
 * seek, and a seek is audible; without a floor a persistent offset would be
 * "corrected" on every frame and turn into a stutter.
 */
const RESYNC_COOLDOWN_MS = 1000;

/**
 * Gap between the store's time and the engine's own that means somebody moved
 * the playhead. During playback the engine writes both on every tick, so they
 * sit on top of each other; anything wider came from outside.
 */
const EXTERNAL_SEEK_MS = 100;

/**
 * Paliers d'assets de main, du plus petit au plus grand. CUSTOM_HANDS decrit
 * chacun avec ses propres coordonnees de pointe, et handDrawRect attend le
 * palier NOMINAL correspondant : le figer alors que le canvas change de taille
 * revenait a agrandir le sprite 720p au lieu de prendre le bon fichier.
 */
const PALIERS_MAIN = [720, 1080, 1440] as const;

/** Palier dont la taille nominale couvre le grand cote du canvas. */
function palierPourCanvas(grandCote: number): (typeof PALIERS_MAIN)[number] {
  if (grandCote > 1920) return 1440;
  if (grandCote > 1280) return 1080;
  return 720;
}

const handAssetUrl = (key: string, palier: number) =>
  `/images/hand${key.replace('custom', '')}-${palier}p.png`;

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
  /** Dimensions du canvas. Passees explicitement : muter l'attribut width ne
   *  redeclenche aucun effet, or un changement de forme doit reprojeter. */
  canvasWidth: number;
  canvasHeight: number;
  handCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  annotationCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Dynamic clip image background URL */
  imageUrl?: string | null;
  /** Narration URL. When set, the audio clock drives engine timing instead
   *  of wall-clock time — see docs/superpowers/specs/2026-07-29-whiteboard-audio-design.md */
  audioUrl?: string | null;
  /** 0..1. Muted still plays silently: it must keep driving the clock. */
  audioVolume?: number;
  audioMuted?: boolean;
  /**
   * Narration length in ms, captured when the track was added. The video lasts
   * as long as its narration, and this value is read straight from the config
   * rather than the media element, which can stall before ever reporting a
   * duration.
   */
  audioDurationMs?: number | null;
  /**
   * Annotations restored from the saved project. Preferred over the demo
   * scene when seeding: without this, a reopened project silently came back
   * with the demo sequence and every edit made to it was lost.
   */
  savedAnnotations?: Annotation[] | null;
}

export function useWhiteboardRenderer({
  canvasRef,
  canvasWidth,
  canvasHeight,
  handCanvasRef,
  annotationCanvasRef,
  imageUrl = null,
  audioUrl = null,
  audioVolume = 1,
  audioMuted = false,
  audioDurationMs = null,
  savedAnnotations = null,
}: UseWhiteboardRendererProps) {
  const {
    progress,
    isPlaying,
    currentTime,
    canvasBg,
    animStyle,
    handStyle,
    handSpeed,
    chunks,
  } = useUnifiedEngine();

  const audioClock = useAudioClock(audioUrl);

  // Narration length, preferring the decoded value and falling back to what
  // the config recorded — a stalled element never reports one.
  const narrationMs =
    audioClock.isReady && audioClock.durationMs > 0
      ? audioClock.durationMs
      : (audioDurationMs ?? 0);

  // With narration, the schedule is the drawing plan, not the clip length.
  const derivedAnnotations = useDerivedAnnotations({
    governsDuration: narrationMs <= 0,
  });
  const { annotations } = derivedAnnotations;

  const imageRef = useRef<HTMLImageElement | null>(null);
  // Rectangle ou l'artwork est dessine. Memorise pour pouvoir transporter les
  // regions quand le canvas change de forme.
  const rectRef = useRef<RectContenu | null>(null);
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
  // The drawing reached the end of its schedule. The video can still be
  // running: with narration longer than the schedule, the finished image is
  // held on screen while the audio plays out.
  const drawingDoneRef = useRef(false);
  // A new clip took over and its engine has to be placed on the running clock
  // before it draws. Its annotations start at the clip's global offset, so a
  // freshly built engine would otherwise animate its way through that whole
  // lead-in gap instead of skipping it.
  const pendingClipResyncRef = useRef(false);

  // Muted still plays (silently) to keep serving as the clock — only volume
  // and the mute flag change, never whether it plays.
  useEffect(() => {
    audioClock.manager?.setVolume(audioVolume);
    audioClock.manager?.setMuted(audioMuted);
  }, [audioClock.manager, audioVolume, audioMuted]);
  const [imageLoaded, setImageLoaded] = useState(false);
  // Vrai pendant qu'on scrube. Le seek ne "joue" pas — isPlaying reste faux —
  // mais l'utilisateur regarde le dessin, pas les cadres : le calque doit
  // s'effacer la aussi. Un delai de retour evite qu'il ne clignote entre deux
  // positions pendant un drag.
  const [scrubbing, setScrubbing] = useState(false);
  const scrubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest config, readable from inside the rAF closure without re-subscribing.
  const cfgRef = useRef({ handStyle, canvasBg });
  cfgRef.current = { handStyle, canvasBg };

  // How long the drawing itself runs. The engine reports progress over this
  // span, which is shorter than the video whenever narration outlasts it.
  const drawingSpanRef = useRef(0);
  drawingSpanRef.current = derivedAnnotations.totalDurationMs;

  // ---- assets -------------------------------------------------------------

  useEffect(() => {
    // Only the FIRST artwork gates the renderer. Later ones arrive because the
    // playing clip changed, and dropping imageLoaded there would tear the run
    // loop down mid-playback — which pauses the narration and leaves the old
    // rAF writing the clock alongside the new one, running it fast. The new
    // artwork is swapped in on arrival instead, and the engine rebuilt around
    // it, while the loop and the narration carry on untouched.
    const isFirstArtwork = !imageRef.current;
    if (isFirstArtwork) setImageLoaded(false);

    let cancelled = false;
    const img = new Image();
    const targetSrc = imageUrl || SCENE_IMAGE;
    img.src = targetSrc;
    img.onload = () => {
      if (cancelled) return;
      imageRef.current = img;
      // The engine reveals from an offscreen copy of the artwork, so both it
      // and the instance built from it belong to the previous clip.
      offscreenRef.current = null;
      animRef.current = null;
      drawingDoneRef.current = false;
      pendingClipResyncRef.current = true;
      if (isFirstArtwork) setImageLoaded(true);
    };
    img.onerror = () => console.error('Failed to load scene image', targetSrc);

    ['custom1', 'custom2', 'custom3', 'custom4'].forEach((key) => {
      PALIERS_MAIN.forEach((palier) => {
        const h = new Image();
        h.src = handAssetUrl(key, palier);
        h.onload = () => {
          handImagesRef.current[`${key}@${palier}`] = h;
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  // Amorcage de la scene de demo, puis suivi de la forme du canvas.
  const seededRef = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    const rect = rectArtwork(canvas);
    const store = useUnifiedEngineStore.getState();

    if (!seededRef.current && store.animation.annotations.length === 0) {
      seededRef.current = true;
      rectRef.current = rect;

      // A saved project wins over the demo scene. Its regions are already in
      // canvas pixels from the session that wrote them, so they are taken as
      // they are; only the demo sequence needs projecting onto the artwork.
      if (savedAnnotations && savedAnnotations.length > 0) {
        store.setAnnotations(savedAnnotations);
        return;
      }

      // normalizeGaps turns the authored absolute startMs into the derived
      // model (order + duration + gap) the timeline editor works with.
      // Les regions sont projetees sur le RECTANGLE D'ARTWORK, pas sur le
      // canvas : hors de ce rectangle il n'y a que du fond.
      normalizeGaps(
        projectAnnotations(SCENE_PREMIUM_BAG_ANNOTATIONS, rect.w, rect.h)
      ).forEach((a) =>
        store.addAnnotation({
          ...a,
          region: {
            ...a.region,
            x: a.region.x + rect.x,
            y: a.region.y + rect.y,
          },
        })
      );
      return;
    }
    seededRef.current = true;

    const precedent = rectRef.current;
    rectRef.current = rect;
    if (
      !precedent ||
      (precedent.x === rect.x &&
        precedent.y === rect.y &&
        precedent.w === rect.w &&
        precedent.h === rect.h)
    ) {
      return;
    }

    // Le canvas a change de forme. Les regions sont stockees en pixels de
    // canvas : sans cela elles resteraient aux coordonnees de l'ancienne
    // forme, a cote du dessin. On les TRANSPORTE plutot que de les regenerer
    // depuis la scene de demo, pour ne pas perdre les annotations editees.
    const annots = store.animation.annotations;
    if (annots.length) {
      store.setAnnotations(
        annots.map((a: any) =>
          a.region
            ? { ...a, region: { ...a.region, ...reprojeterRegion(a.region, precedent, rect) } }
            : a
        )
      );
    }
    // L'instance a ete batie sur les anciennes bornes.
    animRef.current = null;
  }, [canvasRef, imageLoaded, canvasWidth, canvasHeight]);

  // ---- helpers ------------------------------------------------------------

  /** Rectangle d'artwork pour ce canvas, sans deformation. */
  const rectArtwork = (canvas: HTMLCanvasElement): RectContenu => {
    const img = imageRef.current;
    return rectContenu(
      canvas.width,
      canvas.height,
      img?.naturalWidth || canvas.width,
      img?.naturalHeight || canvas.height
    );
  };

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
    const palier = palierPourCanvas(
      Math.max(handCanvas.width, handCanvas.height)
    );
    const imgConfig = CUSTOM_HANDS[key]?.images?.[palier];
    // Un palier peut ne pas etre encore charge : on retombe sur le 720, qui
    // l'est en premier, plutot que de sauter la frame et faire clignoter la main.
    const sprite =
      handImagesRef.current[`${key}@${palier}`] ??
      handImagesRef.current[`${key}@720`] ??
      handImagesRef.current['custom1@720'];

    if (imgConfig && sprite?.complete) {
      const r = handDrawRect(
        imgConfig,
        palier,
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
      const r = rectArtwork(canvas);
      ctx.drawImage(imageRef.current, r.x, r.y, r.w, r.h);
    }
  };

  // ---- engine-driven playback --------------------------------------------

  // The video runs until BOTH the drawing and the narration are done —
  // `max(last annotation, audio)`, per the audio design spec. Letting the
  // narration win outright would cut a drawing that outlasts it. With no
  // narration, useDerivedAnnotations owns the duration instead.
  useEffect(() => {
    if (narrationMs <= 0) return;
    const videoMs = Math.max(derivedAnnotations.totalDurationMs, narrationMs);
    useUnifiedEngineStore.getState().setDuration(videoMs);
  }, [narrationMs, derivedAnnotations.totalDurationMs]);

  // Changing what the engine was built from invalidates the instance, so the
  // next play rebuilds it. Reveal speed is read live in tick(), so it is absent.
  useEffect(() => {
    animRef.current = null;
  }, [animStyle, handStyle, handSpeed, chunks]);

  // Switching clip swaps the whole sequence under the engine. `drawingDone` has
  // to fall with it: the previous clip having finished is what otherwise keeps
  // the run loop from rebuilding, and the canvas would hold that last frame for
  // the rest of the video. The clock and the narration are deliberately left
  // alone — only the drawing restarts, on a timeline that never rewinds.
  const sequenceKey = annotations.map((a) => a.id).join('|');
  useEffect(() => {
    animRef.current = null;
    drawingDoneRef.current = false;
    pendingClipResyncRef.current = true;
  }, [sequenceKey]);

  // Offscreen holds the source artwork the engine reveals from.
  const ensureOffscreen = (canvas: HTMLCanvasElement) => {
    let offscreen = offscreenRef.current;
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      offscreenRef.current = offscreen;
    }
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const rect = rectArtwork(canvas);
    offscreen
      .getContext('2d')
      ?.drawImage(imageRef.current!, rect.x, rect.y, rect.w, rect.h);
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
      // Fige au 1x fidele : voir le commentaire de ENGINE_DEFAULT_SPEED.
      speed: ENGINE_DEFAULT_SPEED,
      handSpeed,
      hand: normalizeHandKey(handStyle),
      tileSlider: chunks,
      // Les bornes suivent l'artwork : hors de ce rectangle il n'y a que du
      // fond, et le tampon de fin ne doit pas y baver.
      contentBounds: rectArtwork(canvas),
      // Toujours en mode annotation : c'est le modele de l'editeur, pas une
      // option. config.useAnnotation subsiste pour les projets enregistres
      // mais n'est plus lu.
      annotations: deriveTimeline(store.animation.annotations).annotations,
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
          // p runs over the DRAWING, which is shorter than the video when
          // narration outlasts it — scaling by the video duration here would
          // race the playhead ahead of the strokes.
          const span = drawingSpanRef.current || s.timeline.duration;
          const ms = Math.min(1, Math.max(0, p)) * span;
          engineTimeRef.current = ms;
          s.setCurrentTime(ms);
        },
        finishAnim: () => {
          if (seekingRef.current) {
            stoppedRef.current = true;
            hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
            return;
          }
          // The drawing is done; the video may not be. Retire the engine and
          // hold the finished image — the loop runs the clock out to the end.
          drawingDoneRef.current = true;
          animRef.current = null;
          hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
          const s = useUnifiedEngineStore.getState();
          const span = drawingSpanRef.current || s.timeline.duration;
          engineTimeRef.current = span;
          if (span >= s.timeline.duration - 1) {
            // No narration left to play out: the video ends with the drawing.
            stoppedRef.current = true;
            s.setCurrentTime(s.timeline.duration);
            s.setIsPlaying(false);
          }
        },
        resScale: () => 1,
        resPointScale: () => 1,
      },
    });

    anim.setup?.();
    activeStyleRef.current = animStyle;
    return anim;
  };

  /**
   * Repaint the drawing as it stands at `targetMs`, leaving a live engine
   * primed there.
   *
   * Shared by scrubbing and by a seek made DURING playback: a running loop
   * cannot simply be told a new time, because the engine only ticks forward
   * and its next frame would write the old position straight back.
   */
  const repositionTo = (
    targetMs: number,
    canvas: HTMLCanvasElement,
    handCanvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    hctx: CanvasRenderingContext2D
  ) => {
    const offscreen = ensureOffscreen(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintBackground(ctx, canvas.width, canvas.height);
    hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    stoppedRef.current = false;
    seekingRef.current = true;
    try {
      const anim = buildEngine(canvas, handCanvas, ctx, hctx, offscreen);
      const schedule = anim.annotationManager?.schedule;

      // Le moteur tournant au 1x fidele, son horloge avance exactement du
      // delta fourni : le pas du rejeu est donc la ms demandee.
      const advance = (from: number, to: number) => {
        for (let elapsed = from; elapsed < to; elapsed += SEEK_STEP_MS) {
          if (stoppedRef.current) break;
          const slice = Math.min(SEEK_STEP_MS, to - elapsed);
          anim.tick?.(ENGINE_DEFAULT_SPEED, slice);
        }
      };

      if (!schedule || schedule.length === 0) {
        // Pas d'annotations : le style s'anime d'un bloc, seul un rejeu
        // depuis le debut donne la bonne image.
        advance(0, targetMs);
      } else {
        // Premiere region non terminee a cet instant.
        const idx = schedule.findIndex((s: any) => targetMs < s.endMs);

        if (idx === -1) {
          // Apres la derniere region : le moteur tamponne toute l'image en
          // terminant, y compris ce qu'aucune region ne couvre.
          const rf = rectArtwork(canvas);
          ctx.drawImage(imageRef.current!, rf.x, rf.y, rf.w, rf.h);
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
          if (targetMs >= entry.startMs) {
            // Dans la region : on repart de sa frontiere, deja peinte.
            anim.primeAt?.(entry.startMs);
            advance(entry.startMs, targetMs);
          } else {
            // Dans une pause entre deux annotations : rien de plus a tracer,
            // et la main n'a pas a rester figee sur le dernier trait.
            anim.primeAt?.(targetMs);
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
      // Seeking redefines whether the drawing is behind us: landing before
      // the end of the schedule must let playback rebuild and draw again.
      drawingDoneRef.current =
        drawingSpanRef.current > 0 && targetMs >= drawingSpanRef.current;
    }

    engineTimeRef.current = targetMs;
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

    // Play pressed while parked at the end replays from the top. The engine
    // instance is consumed here so the clear below runs: without it the new
    // run paints over the finished drawing and early frames show strokes that
    // belong to the previous pass.
    {
      const s = useUnifiedEngineStore.getState();
      if (s.timeline.duration > 0 && s.timeline.currentTime >= s.timeline.duration - 1) {
        animRef.current = null;
        drawingDoneRef.current = false;
        engineTimeRef.current = 0;
        s.setCurrentTime(0);
      }
    }

    // Clear and rebuild only for a fresh run. A finished drawing held while
    // narration plays out has no engine either, and must not be wiped when
    // playback resumes.
    if (!animRef.current && !drawingDoneRef.current) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paintBackground(ctx, canvas.width, canvas.height);
      hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);

      const offscreen = ensureOffscreen(canvas);
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
    let isFirstFrame = true;
    const manager = audioClock.manager;
    // The narration is NOT started here. An element that is not ready yet
    // would play from a stale position and come in behind the drawing, so
    // starting it is deferred to the loop, which aligns it the moment it can
    // actually play. The drawing never waits for that.
    let audioStarted = false;
    let lastResyncAt = 0;

    const step = (now: number) => {
      if (stoppedRef.current) return;

      // The first frame after a start or a resume carries a stale timestamp.
      if (isFirstFrame) {
        last = now;
        isFirstFrame = false;
        frame = requestAnimationFrame(step);
        return;
      }

      // The WALL CLOCK owns the timeline. The engine only ticks forward and
      // cannot be moved backwards, so driving it from a media element — which
      // buffers, seeks, stalls and ends — meant any hiccup there stopped the
      // drawing outright.
      const rawDelta = now - last;
      last = now;
      // A real slow frame is honoured in full; only a parked rAF is dropped.
      const parked = rawDelta > BIG_GAP_MS;
      const delta = parked ? 0 : rawDelta;

      const s = useUnifiedEngineStore.getState();

      // A clip just took over. Place its engine on the clock the narration is
      // already running on: repositionTo skips the lead-in gap rather than
      // animating through it. Deliberately NOT the seek path below — the
      // narration is one continuous take and must never be dragged back.
      if (pendingClipResyncRef.current) {
        pendingClipResyncRef.current = false;
        repositionTo(s.timeline.currentTime, canvas, handCanvas, ctx, hctx);
        if (!stoppedRef.current) frame = requestAnimationFrame(step);
        return;
      }

      // The playhead can be moved WHILE playing — clicking the ruler, say.
      // currentTime is an INPUT then, not the engine's own output: the engine
      // has to be replayed to the new position, or the very next tick writes
      // the old one back and the click looks like it did nothing.
      if (
        Math.abs(s.timeline.currentTime - engineTimeRef.current) >
        EXTERNAL_SEEK_MS
      ) {
        repositionTo(s.timeline.currentTime, canvas, handCanvas, ctx, hctx);
        if (manager?.isUsableClock()) {
          manager.seekMs(engineTimeRef.current);
          lastResyncAt = now;
        }
        frame = requestAnimationFrame(step);
        return;
      }

      if (drawingDoneRef.current) {
        // Drawing complete, narration still running: hold the image and run
        // the clock out to the end of the video.
        const next = s.timeline.currentTime + delta;
        engineTimeRef.current = next;
        s.setCurrentTime(next);
      } else {
        animRef.current?.tick?.(ENGINE_DEFAULT_SPEED, delta);
      }

      // The narration FOLLOWS the drawing. A track that cannot report a
      // position is left alone rather than allowed to hold up the picture.
      if (manager?.isUsableClock()) {
        if (!audioStarted) {
          // First moment it can actually play. Align it on the drawing, which
          // has been running meanwhile, so a track that took a while to load
          // does not come in behind and then have to be dragged forward.
          if (Math.abs(manager.getCurrentMs() - engineTimeRef.current) > DRIFT_MAX_MS) {
            manager.seekMs(engineTimeRef.current);
          }
          manager.play().catch((err) => {
            console.error('Failed to start audio playback:', err);
          });
          audioStarted = true;
          lastResyncAt = now;
        } else if (parked || now - lastResyncAt > RESYNC_COOLDOWN_MS) {
          // Correcting is a seek, and a seek is audible: rate-limited, so a
          // renderer that cannot keep up drifts audibly once a second instead
          // of stuttering every frame. A parked tab is realigned immediately —
          // the offset there is the whole time away, not jitter.
          if (Math.abs(manager.getCurrentMs() - engineTimeRef.current) > DRIFT_MAX_MS) {
            manager.seekMs(engineTimeRef.current);
            lastResyncAt = now;
          }
        }
      }

      // Annotation styles finish their schedule without ever calling
      // finishAnim, which left the transport running past the end: the button
      // stayed on Pause and the run was never marked stopped. Ending it here
      // makes "finished" observable to the rest of the renderer.
      if (
        s.timeline.duration > 0 &&
        s.timeline.currentTime >= s.timeline.duration - 1
      ) {
        stoppedRef.current = true;
        animRef.current = null;
        engineTimeRef.current = s.timeline.duration;
        hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
        manager?.pause();
        s.setIsPlaying(false);
        return;
      }

      if (!stoppedRef.current) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    // Keep animRef so a pause can resume; only cancel the frame loop.
    return () => {
      stoppedRef.current = true;
      cancelAnimationFrame(frame);
      manager?.pause();
    };
  }, [isPlaying, imageLoaded, audioClock.manager]);

  // ---- seek ---------------------------------------------------------------

  // Pas fixe utilise pour rejouer le moteur jusqu'a la position cherchee. La
  // cadence des styles est pilotee par le temps ecoule et non par un nombre de
  // frames, donc un pas grossier tombe sur la meme image que la lecture reelle.
  const SEEK_STEP_MS = 33.34;

  /** Delai avant que le calque d'annotations ne revienne apres un scrub. */
  const SCRUB_RETOUR_MS = 400;

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

    setScrubbing(true);
    if (scrubTimer.current) clearTimeout(scrubTimer.current);
    scrubTimer.current = setTimeout(() => setScrubbing(false), SCRUB_RETOUR_MS);

    // Un drag emet un flot de seeks : on n'en rejoue qu'un par frame.
    const raf = requestAnimationFrame(() => {
      repositionTo(currentTime, canvas, handCanvas, ctx, hctx);
    });

    return () => cancelAnimationFrame(raf);
  }, [currentTime, isPlaying, imageLoaded]);

  // Static preview only at the very start (or after Reset). Pausing mid-run
  // must leave the engine's partial frame on screen.
  useEffect(() => {
    if (isPlaying || currentTime > 0) return;
    animRef.current = null;
    drawingDoneRef.current = false;
    engineTimeRef.current = 0;
    const handCanvas = handCanvasRef.current;
    handCanvas
      ?.getContext('2d')
      ?.clearRect(0, 0, handCanvas.width, handCanvas.height);
    drawStaticPreview();
  }, [isPlaying, currentTime, imageLoaded, canvasBg, canvasRef, handCanvasRef, imageUrl]);

  // ---- annotation overlay -------------------------------------------------

  // Le calque est un repere d'EDITION : il masque le dessin qu'on est venu
  // regarder. Il s'efface donc des que ca bouge — lecture ou scrub — et revient
  // a l'arret, fin de lecture comprise.
  //
  // Expose parce que le calque Konva (AnnotationOverlay), qui remplace le
  // trace imperatif ci-dessous sur la surface de l'editeur, doit se masquer
  // exactement aux memes instants.
  const isOverlayHidden = isPlaying || scrubbing;

  useEffect(() => {
    const annCanvas = annotationCanvasRef?.current;
    if (!annCanvas) return;

    const actx = annCanvas.getContext('2d');
    if (!actx) return;

    const masque = isOverlayHidden;
    annCanvas.style.opacity = masque ? '0' : '1';

    actx.clearRect(0, 0, annCanvas.width, annCanvas.height);
    if (masque || annotations.length === 0) return;

    annotations.forEach((annot, i) => {
      const region = annot.region;
      if (!region) return;

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
  }, [annotations, annotationCanvasRef, isOverlayHidden]);

  return { isOverlayHidden };
}
