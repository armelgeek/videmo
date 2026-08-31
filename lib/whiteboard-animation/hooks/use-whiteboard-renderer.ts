'use client';

import { useEffect, useRef, useState } from 'react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import {
  SCENE_PREMIUM_BAG_ANNOTATIONS,
  projectAnnotations,
} from '../data/scene-premium-bag';
import { rectContenu, reprojeterRegion, type RectContenu } from '../canvas-size';
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
 * Longest frame the engine is advanced by in one tick. A backgrounded tab
 * stops rAF entirely; without a ceiling the first frame back would advance the
 * drawing by the whole time away, in a single jump.
 */
const MAX_FRAME_MS = 100;

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
}

export function useWhiteboardRenderer({
  canvasRef,
  canvasWidth,
  canvasHeight,
  handCanvasRef,
  annotationCanvasRef,
  audioUrl = null,
  audioVolume = 1,
  audioMuted = false,
  audioDurationMs = null,
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
    const img = new Image();
    img.src = SCENE_IMAGE;
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => console.error('Failed to load scene image', SCENE_IMAGE);

    ['custom1', 'custom2', 'custom3', 'custom4'].forEach((key) => {
      PALIERS_MAIN.forEach((palier) => {
        const h = new Image();
        h.src = handAssetUrl(key, palier);
        h.onload = () => {
          handImagesRef.current[`${key}@${palier}`] = h;
        };
      });
    });
  }, []);

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
    if (manager) {
      // The narration IS the clock, so it has to start from where the timeline
      // is. Reset and scrubbing move the timeline only; leaving the element
      // where it was let it drag the drawing to that position on the next play
      // — a Reset then Play would jump straight back to the old spot.
      // Tolerance, not equality: seeking re-buffers, and a plain resume leaves
      // a few ms of gap. Correcting that on every pause/play reloaded the
      // track each time and stuttered the drawing for nothing.
      const timelineMs = useUnifiedEngineStore.getState().timeline.currentTime;
      if (Math.abs(manager.getCurrentMs() - timelineMs) > 250) {
        manager.seekMs(timelineMs);
      }
      // The audio element is the clock this loop reads from every frame —
      // without starting it, getCurrentMs() stays frozen at 0 forever and
      // the engine never advances.
      manager.play().catch((err) => {
        console.error('Failed to start audio playback:', err);
      });
    }

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
      // drawing outright. Clamped so a throttled background tab does not
      // deliver one enormous frame on return.
      const delta = Math.min(MAX_FRAME_MS, now - last);
      last = now;

      const s = useUnifiedEngineStore.getState();
      if (drawingDoneRef.current) {
        // Drawing complete, narration still running: hold the image and run
        // the clock out to the end of the video.
        const next = s.timeline.currentTime + delta;
        engineTimeRef.current = next;
        s.setCurrentTime(next);
      } else {
        animRef.current?.tick?.(ENGINE_DEFAULT_SPEED, delta);
      }

      // The narration FOLLOWS the drawing. Correcting it is audible, so it is
      // only nudged once the offset is past the point where it would itself be
      // noticeable — and a track that cannot report a position is left alone
      // rather than allowed to hold up the picture.
      if (manager?.isUsableClock()) {
        if (Math.abs(manager.getCurrentMs() - engineTimeRef.current) > DRIFT_MAX_MS) {
          manager.seekMs(engineTimeRef.current);
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
          advance(0, currentTime);
        } else {
          // Premiere region non terminee a cet instant.
          const idx = schedule.findIndex((s: any) => currentTime < s.endMs);

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
        // Seeking redefines whether the drawing is behind us: landing before
        // the end of the schedule must let playback rebuild and draw again.
        drawingDoneRef.current =
          drawingSpanRef.current > 0 && currentTime >= drawingSpanRef.current;
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
    drawingDoneRef.current = false;
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

    // Le calque est un repere d'EDITION : il masque le dessin qu'on est venu
    // regarder. Il s'efface donc des que ca bouge — lecture ou scrub — et
    // revient a l'arret, fin de lecture comprise.
    const masque = isPlaying || scrubbing;
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
  }, [annotations, annotationCanvasRef, isPlaying, scrubbing]);
}
