'use client';

import { useEffect, useRef, useState } from 'react';
import { annotationColors } from '../schema';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import * as selectors from '@/lib/unified-engine/hooks/selectors';
import { filterScene } from '@/lib/unified-engine/hooks/selectors';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import {
  SCENE_PREMIUM_BAG_ANNOTATIONS,
  projectAnnotations,
} from '../data/scene-premium-bag';
import { rectContenu, reprojeterRegion, type RectContenu } from '../canvas-size';
import type { Annotation } from '@/lib/unified-engine/types';
import { deriveTimeline } from '../timeline/derive-timeline';
import { transitionAt, type ClipWindow } from '../timeline/clip-transitions';
import { normalizeGaps } from '../timeline/normalize-gaps';
import { planSeek } from '../timeline/plan-seek';
import { useDerivedAnnotations } from '../timeline/use-derived-annotations';
import { sansAttenteInitiale } from '../timeline/sans-attente-initiale';
import { DRIFT_MAX_MS } from './audio-delta';
import { useNarrationClock } from '../audio/use-narration-clock';
import { AUCUNE_PART } from '../audio/narration-schedule';
import type { NarrationPart } from '../audio/narration-schedule';

const AnimationFactory = require('../lib/index');
const { CUSTOM_HANDS } = require('../lib/hands');
const { handDrawRect } = require('../lib/handLayout');
const { resoudreTransition } = require('../lib/transitions');
const { whitenBackground } = require('../lib/white-background');
const { warmPresenceMap, seedPresenceMap } = require('../lib/presence-map');

type PreparedSheet = { sheet: ImageBitmap; map: Uint8Array };

/** One worker for the page: preparing a sheet never needs to run in parallel. */
let sheetWorker: Worker | null | undefined;
/** Jobs by sheet key: a scene asked twice (effect re-run, fast skip) is prepared once. */
const sheetJobs = new Map<string, { resolve: (r: PreparedSheet) => void; reject: (e: Error) => void; promise: Promise<PreparedSheet> }>();

const failAllJobs = (reason: string) => {
  for (const job of sheetJobs.values()) job.reject(new Error(reason));
  sheetJobs.clear();
};

const getSheetWorker = (): Worker | null => {
  if (sheetWorker !== undefined) return sheetWorker;
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    sheetWorker = null;
    return null;
  }
  try {
    const worker = new Worker(new URL('../lib/sheet-prep.worker.js', import.meta.url));
    worker.addEventListener('message', (event: MessageEvent) => {
      const { id, sheet, map, error } = event.data ?? {};
      const job = sheetJobs.get(id);
      if (!job) {
        sheet?.close?.();
        return;
      }
      sheetJobs.delete(id);
      if (error || !sheet) job.reject(new Error(error || 'empty sheet'));
      else job.resolve({ sheet, map });
    });
    // A worker that fails to load never answers: drop it so callers fall back.
    worker.addEventListener('error', () => {
      sheetWorker = null;
      worker.terminate();
      failAllJobs('sheet worker failed');
    });
    sheetWorker = worker;
  } catch {
    sheetWorker = null;
  }
  return sheetWorker;
};

const requestPreparedSheet = async (
  worker: Worker,
  key: string,
  img: HTMLImageElement,
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
): Promise<PreparedSheet> => {
  const existing = sheetJobs.get(key);
  if (existing) return existing.promise;
  let resolve!: (r: PreparedSheet) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<PreparedSheet>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  sheetJobs.set(key, { resolve, reject, promise });
  try {
    const bitmap = await createImageBitmap(img);
    worker.postMessage({ id: key, bitmap, width, height, rect }, [bitmap]);
  } catch (err) {
    sheetJobs.delete(key);
    reject(err instanceof Error ? err : new Error(String(err)));
  }
  return promise;
};

const SCENE_IMAGE = '/scene-premium-bag.png';

/**
 * The engine's 1x (Animation.DEFAULT_SPEED). At this value each annotation's
 * durationMs is honoured exactly.
 *
 * The clock is fixed here rather than wired to a setting: reveal.from/to are
 * NARRATION timestamps, so any multiplier would make the drawing drift from
 * its soundtrack. config.revealSpeed remains for already saved projects but
 * is no longer read.
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

/** Number of decoded images kept in cache, beyond which the oldest gives way. */
const IMAGE_CACHE_MAX = 32;

/**
 * Module-level caches: they persist from one render/mount to the next.
 * Returning to an already visited scene or switching tabs redoes no fetch,
 * no CPU/GPU decoding and no Web Worker computation.
 */
const globalImageCache = new Map<string, HTMLImageElement>();
const globalOffscreenCache = new Map<string, HTMLCanvasElement>();

/** While scrubbing, a scene is only prepared once the cursor settles on it. */
const SCRUB_PREP_DELAY_MS = 120;

/** Moves a cache hit to the young end, so eviction drops the least recently used. */
const touch = <V,>(cache: Map<string, V>, key: string, value: V) => {
  cache.delete(key);
  cache.set(key, value);
};
/** How long a new scene plays before the next one starts being prepared. */
const NEXT_SCENE_PREP_DELAY_MS = 2000;

/**
 * Minimum spacing between two corrections of the narration. Each one is a
 * seek, and a seek is audible; without a floor a persistent offset would be
 * "corrected" on every frame and turn into a stutter.
 */
const RESYNC_COOLDOWN_MS = 1000;

/**
 * Gap between the store's time and the engine's own that means somebody moved
 * the playhead. The engine publishes the store at PUBLISH_INTERVAL_MS, so the
 * two can legitimately sit up to one interval apart; anything wider than that
 * came from outside.
 */
const EXTERNAL_SEEK_MS = 100;

/**
 * Rate at which the clock is PUBLISHED to the store.
 *
 * The engine advances every frame, but each currentTime write re-renders
 * every subscriber — the whole timeline, its rulers, its tracks. At 60 Hz the
 * React render cost more than the drawing itself. The REAL clock remains
 * engineTimeRef, updated every tick: only its publication is slowed down,
 * so nothing drifts. Must stay well under EXTERNAL_SEEK_MS, otherwise the
 * publication lag would pass for a cursor move.
 */
const PUBLISH_INTERVAL_MS = 1000 / 30;

/**
 * Hand asset tiers, smallest to largest. CUSTOM_HANDS describes each with its
 * own tip coordinates, and handDrawRect expects the matching NOMINAL tier:
 * freezing it while the canvas changed size amounted to upscaling the 720p
 * sprite instead of taking the right file.
 */
const HAND_TIERS = [720, 1080, 1440] as const;

/** Tier whose nominal size covers the canvas's long side. */
function tierForCanvas(longSide: number): (typeof HAND_TIERS)[number] {
  if (longSide > 1920) return 1440;
  if (longSide > 1280) return 1080;
  return 720;
}

const handAssetUrl = (key: string, tier: number) =>
  `/images/hand${key.replace('custom', '')}-${tier}p.png`;

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
  /** Canvas dimensions. Passed explicitly: mutating the width attribute
   *  re-triggers no effect, yet a shape change must reproject. */
  canvasWidth: number;
  canvasHeight: number;
  handCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  annotationCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Dynamic clip image background URL */
  imageUrl?: string | null;
  /** Image URL of the upcoming scene for look-ahead pre-caching */
  nextImageUrl?: string | null;
  /** Image URLs of upcoming scenes (N+1, N+2) for multi-scene look-ahead pre-caching */
  upcomingImageUrls?: (string | null | undefined)[];
  /** Narration URL. When set, the audio clock drives engine timing instead
   *  of wall-clock time — see docs/superpowers/specs/2026-07-29-whiteboard-audio-design.md */
  audioUrl?: string | null;
  /**
   * The voice produced beat by beat. It takes precedence over `audioUrl`,
   * which remains the path for an uploaded track and for older projects.
   */
  narrationParts?: NarrationPart[];
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
  /**
   * The scene being drawn: the engine store holds every scene flat, this id
   * says which one to read/write here. `null` (the default) disables filtering —
   * the behaviour from before the flat array, for standalone use with no
   * notion of scene.
   */
  scenePanelId?: string | null;
  /**
   * Global start of this clip on the shared narration clock, in milliseconds.
   *
   * The engine always receives 0-based (clip-local) annotations. This value
   * is used by the renderer to translate between the global clock that the
   * store and the narration use, and the local clock that the engine uses.
   *
   * Clip 1: 0 ms (no translation needed).
   * Clip N: sum of all preceding clips' durations.
   */
  clipOffsetMs?: number;
  /**
   * Full sequence, to know where the gaps between clips fall.
   * clipOffsetMs is otherwise unchanged: it designates the ACTIVE clip and is
   * used to convert the global clock to the engine's local clock.
   */
  clips?: ClipWindow[];
  /**
   * onError callback
   */
  onError?: (message: string) => void;
  /**
   * Notified when artwork preparation starts or ends.
   * Lets the caller manage a debounced loading indicator without forcing a
   * systematic re-render of the parent component through returned state.
   */
  onArtworkPendingChange?: (pending: boolean) => void;
}

const NOOP_ON_ERROR = (_message: string) => {};

export function useWhiteboardRenderer({
  canvasRef,
  canvasWidth,
  canvasHeight,
  handCanvasRef,
  annotationCanvasRef,
  imageUrl = null,
  nextImageUrl = null,
  upcomingImageUrls,
  audioUrl = null,
  narrationParts = AUCUNE_PART as NarrationPart[],
  audioVolume = 1,
  audioMuted = false,
  audioDurationMs = null,
  savedAnnotations = null,
  scenePanelId = null,
  clipOffsetMs = 0,
  clips = [],
  onError = NOOP_ON_ERROR,
  onArtworkPendingChange,
}: UseWhiteboardRendererProps) {
  // Always the latest function received, without entering the dependencies
  // of the effects that call it: a component passing an inline closure would
  // make a new one every render, and every effect would re-run.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onArtworkPendingChangeRef = useRef(onArtworkPendingChange);
  onArtworkPendingChangeRef.current = onArtworkPendingChange;
  // Neither `progress` nor `currentTime`: read through a selector, they
  // re-rendered the host component — the whole editor and its timeline — on
  // every clock publication during playback. Effects that follow the position
  // subscribe to the store directly.
  const {
    isPlaying,
    canvasBg,
    animStyle,
    handStyle,
    handSpeed,
    chunks,
  } = useUnifiedEngine<{
    isPlaying: boolean;
    canvasBg: string;
    animStyle: string;
    handStyle: string;
    handSpeed: number | undefined;
    chunks: number | undefined;
  }>((state) => ({
    isPlaying: selectors.selectIsPlaying(state),
    canvasBg: selectors.selectCanvasBg(state),
    animStyle: selectors.selectAnimStyle(state),
    handStyle: selectors.selectHandStyle(state),
    handSpeed: selectors.selectHandSpeed(state),
    chunks: selectors.selectChunks(state),
  }));

  const audioClock = useNarrationClock(narrationParts, audioUrl, (m) =>
    onErrorRef.current(m),
  );

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
  // An already decoded image, by URL: returning to an already seen clip must
  // neither re-download nor re-decode it. Shared at module level (globalImageCache).
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(globalImageCache);
  const offscreenCacheRef = useRef<Map<string, HTMLCanvasElement>>(globalOffscreenCache);
  // Rectangle where the artwork is drawn, PER SCENE (key = scenePanelId, or a
  // fixed key in standalone mode): each scene has its own image, hence its
  // own rectangle, and carrying regions over on resize must never mix one
  // scene's rectangle with another's regions.
  const rectBySceneRef = useRef<Map<string | null, RectContenu>>(new Map());
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const handImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const animRef = useRef<any>(null);
  const activeStyleRef = useRef<string>('');
  // Guards the engine callbacks. Held in a ref, not a per-run closure: the
  // instance outlives a run (pause/resume, StrictMode remount) and a stale
  // closure flag would silently disable its callbacks forever.
  const stoppedRef = useRef(false);
  // True while the engine is replayed to reach a sought position: callbacks
  // must then write nothing to the store, otherwise the seek would fight the
  // value the user just set.
  const seekingRef = useRef(false);
  // Last currentTime WRITTEN by the engine. Used to tell a user seek from
  // plain playback progress.
  const engineTimeRef = useRef(0);
  // Time of the last PUBLICATION to the store, cf. PUBLISH_INTERVAL_MS.
  const lastPublishRef = useRef(0);
  // The POSITION carried by the last publication — the last value the engine
  // itself wrote to the store.
  //
  // It is this, not the engine's current clock, that tells whether the store
  // was changed by SOMEONE ELSE. The store is published at intervals: between
  // two publications it lags by construction, and comparing the current clock
  // to that normal lag mistook slow rendering for a click on the ruler. The
  // engine then repositioned onto a stale value on every overlong frame —
  // playback went backwards without ever advancing.
  const lastPublishedPositionRef = useRef(0);
  // Time of the last seek replay, cf. SEEK_COOLDOWN_MS.
  const lastSeekAtRef = useRef(0);
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
  // Incremented on EVERY illustration set, the first included. imageLoaded only
  // flips for the first (see the loading below): without this counter, the
  // arrival of the next clip's illustration wakes no effect, since the image
  // is held in a ref.
  const [artworkVersion, setArtworkVersion] = useState(0);
  // True while scrubbing. The seek does not "play" — isPlaying stays false —
  // but the user is watching the drawing, not the frames: the overlay must
  // fade out there too. A return delay keeps it from flickering between two
  // positions during a drag.
  const [scrubbing, setScrubbing] = useState(false);
  // Read by the artwork effect, which must not re-run when scrubbing toggles.
  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;
  // True while the incoming clip's artwork loads or its sheet is prepared.
  // Nothing may draw then: imageRef still holds the outgoing artwork, and
  // replaying it at the incoming clip's time showed the wrong picture.
  const artworkPendingRef = useRef(false);
  const markArtworkPending = (pending: boolean) => {
    if (artworkPendingRef.current === pending) return;
    artworkPendingRef.current = pending;
    onArtworkPendingChangeRef.current?.(pending);
  };
  const scrubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest config, readable from inside the rAF closure without re-subscribing.
  const cfgRef = useRef({ handStyle, canvasBg });
  cfgRef.current = { handStyle, canvasBg };

  // How long the drawing itself runs. The engine reports progress over this
  // span, which is shorter than the video whenever narration outlasts it.
  const drawingSpanRef = useRef(0);
  drawingSpanRef.current = derivedAnnotations.totalDurationMs;

  // Global offset of this clip on the narration clock. Kept in a ref so the
  // rAF closure always reads the current clip without a dependency on
  // clipOffsetMs that would tear down and restart the loop on every clip change.
  const clipOffsetMsRef = useRef(0);
  clipOffsetMsRef.current = clipOffsetMs;

  // Same reason as clipOffsetMsRef: the active scene changes at every
  // boundary crossed during continuous playback, and buildEngine (called from
  // the persistent rAF loop) must always read the right one, not that of the
  // render that set up the loop.
  const scenePanelIdRef = useRef<string | null>(null);
  scenePanelIdRef.current = scenePanelId;

  // ---- assets -------------------------------------------------------------

  // Only the sprite in use: the tier the canvas needs, plus its 720 tier that
  // drawHand falls back on while the right one loads. Preloading all four
  // styles at three tiers pulled ~9 MB on every editor open.
  const handRequestedRef = useRef(new Set<string>());
  useEffect(() => {
    if (handStyle === 'ghost') return;
    const key = normalizeHandKey(handStyle);
    const tiers = new Set([720, tierForCanvas(Math.max(canvasWidth, canvasHeight))]);
    for (const tier of tiers) {
      const cacheKey = `${key}@${tier}`;
      if (handRequestedRef.current.has(cacheKey)) continue;
      handRequestedRef.current.add(cacheKey);
      const h = new Image();
      h.onload = () => {
        handImagesRef.current[cacheKey] = h;
      };
      h.onerror = () => handRequestedRef.current.delete(cacheKey);
      h.src = handAssetUrl(key, tier);
    }
  }, [handStyle, canvasWidth, canvasHeight]);

  useEffect(() => {
    const targetSrc = imageUrl || SCENE_IMAGE;

    // Already displayed as is: nothing to redo. Without this short-circuit,
    // returning to an already seen clip recreated an Image(), re-decoded it,
    // and invalidated the engine (offscreen, animation instance) for a
    // strictly unchanged artwork.
    if (
      imageRef.current &&
      imageRef.current.src === targetSrc &&
      imageRef.current.complete &&
      imageRef.current.naturalWidth > 0
    ) {
      markArtworkPending(false);
      return;
    }

    // Only the FIRST artwork gates the renderer. Later ones arrive because the
    // playing clip changed, and dropping imageLoaded there would tear the run
    // loop down mid-playback — which pauses the narration and leaves the old
    // rAF writing the clock alongside the new one, running it fast. The new
    // artwork is swapped in on arrival instead, and the engine rebuilt around
    // it, while the loop and the narration carry on untouched.
    const isFirstArtwork = !imageRef.current;
    if (isFirstArtwork) setImageLoaded(false);

    // If the resource (sheet in offscreenCache or decoded image in memory)
    // is already present, never engage the artworkPending lock, to avoid
    // freezing the render and making the hand disappear.
    const canvas = canvasRef.current;
    const key = canvas ? `${targetSrc}@${canvas.width}x${canvas.height}` : '';
    const isAlreadyCached = Boolean(
      (key && offscreenCacheRef.current.has(key)) ||
      (imageCacheRef.current.get(targetSrc)?.complete)
    );
    markArtworkPending(!isFirstArtwork && !isAlreadyCached);

    let cancelled = false;

    let prepTimer: number | null = null;

    const swapIn = (loadedImg: HTMLImageElement) => {
      if (cancelled) return;
      markArtworkPending(false);
      imageRef.current = loadedImg;
      // The engine reveals from an offscreen copy of the artwork, so both it
      // and the instance built from it belong to the previous clip.
      offscreenRef.current = null;
      animRef.current = null;
      drawingDoneRef.current = false;
      pendingClipResyncRef.current = true;
      if (isFirstArtwork) setImageLoaded(true);
      setArtworkVersion((v) => v + 1);
    };

    // A scene reached by a jump (click, seek) was never prepared ahead: its
    // sheet is built in the worker first, the previous artwork staying on
    // screen meanwhile, instead of freezing the main thread for ~110 ms.
    const applyImage = (loadedImg: HTMLImageElement) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const key = canvas ? `${loadedImg.src}@${canvas.width}x${canvas.height}` : '';
      if (isFirstArtwork || !canvas || offscreenCacheRef.current.has(key) || !getSheetWorker()) {
        swapIn(loadedImg);
        return;
      }
      const start = () => {
        prepTimer = null;
        void prepareSheetInWorker(loadedImg, canvas.width, canvas.height).then(() => swapIn(loadedImg));
      };
      if (scrubbingRef.current) prepTimer = window.setTimeout(start, SCRUB_PREP_DELAY_MS);
      else start();
    };

    const cleanup = () => {
      cancelled = true;
      if (prepTimer !== null) window.clearTimeout(prepTimer);
    };

    const remember = (loadedImg: HTMLImageElement) => {
      const cache = imageCacheRef.current;
      cache.set(targetSrc, loadedImg);
      if (cache.size > IMAGE_CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
    };

    // A clip already visited earlier in the session (A -> B -> A) gets back its
    // already decoded element, with no new request nor new decoding.
    const cached = imageCacheRef.current.get(targetSrc);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      touch(imageCacheRef.current, targetSrc, cached);
      applyImage(cached);
      return cleanup;
    }

    const img = new Image();
    // The engine reveals the drawing by READING the canvas pixels
    // (`getImageData`). Without this attribute, an image served by the bucket —
    // hence from another origin — taints the canvas, and the read throws a
    // SecurityError that keeps the animation from starting. The bucket answers
    // with CORS; it only has to be asked.
    img.crossOrigin = 'anonymous';
    img.src = targetSrc;

    if (img.complete && img.naturalWidth > 0) {
      remember(img);
      applyImage(img);
    } else {
      const handleLoad = () => {
        remember(img);
        if (typeof img.decode === 'function') {
          img.decode()
            .then(() => applyImage(img))
            .catch(() => applyImage(img));
        } else {
          applyImage(img);
        }
      };
      img.onload = handleLoad;
      img.onerror = () => {
        // Unfrozen on failure, or the picture would stay held for good.
        if (!cancelled) markArtworkPending(false);
        console.error('Failed to load scene image', targetSrc);
        onErrorRef.current('Failed to load the image for this clip.');
      };
    }

    return cleanup;
  }, [imageUrl]);

  // ── Look-ahead pre-caching ────────────────────────────────────────────────
  // While a scene plays, preload in the background the image and the Web
  // Worker sheet for the next scene.
  // When playback reaches that scene, everything is already ready in memory:
  // the transition is instant, with no render freeze nor the hand disappearing.
  useEffect(() => {
    const targets = (upcomingImageUrls && upcomingImageUrls.length > 0)
      ? upcomingImageUrls.filter((u): u is string => Boolean(u))
      : nextImageUrl
        ? [nextImageUrl]
        : [];
    if (targets.length === 0) return;

    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : canvasWidth;
    const height = canvas ? canvas.height : canvasHeight;
    let cancelled = false;

    const prefetchTarget = (targetSrc: string) => {
      const key = `${targetSrc}@${width}x${height}`;
      if (offscreenCacheRef.current.has(key)) return;

      const prep = (img: HTMLImageElement) => {
        if (cancelled) return;
        void prepareSheetInWorker(img, width, height);
      };

      const cached = imageCacheRef.current.get(targetSrc);
      if (cached && cached.complete && cached.naturalWidth > 0) {
        prep(cached);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = targetSrc;

      const onImageAvailable = () => {
        if (cancelled) return;
        imageCacheRef.current.set(targetSrc, img);
        // Asynchronous decoding to avoid any GPU freeze on the main thread
        if (typeof img.decode === 'function') {
          img.decode()
            .then(() => prep(img))
            .catch(() => prep(img));
        } else {
          prep(img);
        }
      };

      if (img.complete && img.naturalWidth > 0) {
        onImageAvailable();
      } else {
        img.onload = onImageAvailable;
        img.onerror = () => {
          // Ignore prefetch error silently to avoid unhandled rejections
        };
      }
    };

    targets.forEach((src) => prefetchTarget(src));

    return () => {
      cancelled = true;
    };
  }, [nextImageUrl, upcomingImageUrls, canvasWidth, canvasHeight]);

  // Seeding of the demo scene, then tracking of the canvas shape — per
  // scene: each has its own image, hence its own artwork rectangle, and is
  // seeded only once (instead of once for the whole hook).
  const seededScenesRef = useRef<Set<string | null>>(new Set());
  // Keeps the REAL canvas size so as to reproject only when it actually
  // changes. Without it, a scenePanelId change re-ran the effect,
  // artworkRect() read the OLD imageRef (not swapped yet), produced a rect
  // different from the previous one, and triggered reprojeterRegion → cascade
  // of re-renders (setSceneAnnotations → annotationsEqual → updatePanel).
  const lastCanvasSizeRef = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    const rect = artworkRect(canvas);
    const store = useUnifiedEngineStore.getState();
    const sceneEmpty = filterScene(store.animation.annotations, scenePanelId).length === 0;
    const alreadySeeded = seededScenesRef.current.has(scenePanelId);

    // Standalone mode (no scene): seeds the demo scene, as before the flat
    // array. The multi-scene editor loads every scene in a single pass (see
    // whiteboard-editor-step.tsx) — this is only a safety net for the very
    // first mount, before that load.
    if (!alreadySeeded && sceneEmpty && scenePanelId === null) {
      seededScenesRef.current.add(scenePanelId);
      rectBySceneRef.current.set(scenePanelId, rect);
      lastCanvasSizeRef.current = { w: canvasWidth, h: canvasHeight };

      // A saved project wins over the demo scene. Its regions are already in
      // canvas pixels from the session that wrote them, so they are taken as
      // they are; only the demo sequence needs projecting onto the artwork.
      if (savedAnnotations && savedAnnotations.length > 0) {
        store.setAnnotations(savedAnnotations);
        return;
      }

      // normalizeGaps turns the authored absolute startMs into the derived
      // model (order + duration + gap) the timeline editor works with.
      // Regions are projected onto the ARTWORK RECTANGLE, not onto the
      // canvas: outside that rectangle there is only background.
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

    // Safety net for multi-scene mode: this particular scene has nothing yet
    // in the flat array (first mount before the global load, or a scene
    // never visited). Only its own annotations are poured in.
    if (!alreadySeeded && sceneEmpty && scenePanelId !== null) {
      seededScenesRef.current.add(scenePanelId);
      rectBySceneRef.current.set(scenePanelId, rect);
      lastCanvasSizeRef.current = { w: canvasWidth, h: canvasHeight };
      if (savedAnnotations && savedAnnotations.length > 0) {
        store.setSceneAnnotations(scenePanelId, savedAnnotations);
      }
      return;
    }
    seededScenesRef.current.add(scenePanelId);

    // ── Reprojection guard ────────────────────────────────────────────────
    // Reproject ONLY if the canvas dimensions actually changed.
    // A scenePanelId change alone must NOT trigger a reprojection: imageRef
    // still points to the old image, so artworkRect() returns a rect that
    // does not match the new scene — that was the source of the lag (spurious
    // reprojection → store write → network auto-save → cascade of re-renders).
    const prevCanvasSize = lastCanvasSizeRef.current;
    lastCanvasSizeRef.current = { w: canvasWidth, h: canvasHeight };
    const canvasSizeChanged = !prevCanvasSize
      || prevCanvasSize.w !== canvasWidth
      || prevCanvasSize.h !== canvasHeight;

    if (!canvasSizeChanged) {
      // The canvas did not change size: update the current scene's rect
      // (for future reprojections) but do not reproject.
      rectBySceneRef.current.set(scenePanelId, rect);
      return;
    }

    const previous = rectBySceneRef.current.get(scenePanelId) ?? null;
    rectBySceneRef.current.set(scenePanelId, rect);
    if (
      !previous ||
      (previous.x === rect.x &&
        previous.y === rect.y &&
        previous.w === rect.w &&
        previous.h === rect.h)
    ) {
      return;
    }

    // The canvas changed shape. Regions are stored in canvas pixels: otherwise
    // they would stay at the old shape's coordinates, beside the drawing. They
    // are CARRIED OVER rather than regenerated from the demo scene, so edited
    // annotations are not lost.
    // Only the active scene: the others do not have this canvas in front of them.
    const annots = filterScene(store.animation.annotations, scenePanelId);
    if (annots.length) {
      const reprojected = annots.map((a: any) =>
        a.region
          ? { ...a, region: { ...a.region, ...reprojeterRegion(a.region, previous, rect) } }
          : a
      );
      if (scenePanelId === null) store.setAnnotations(reprojected);
      else store.setSceneAnnotations(scenePanelId, reprojected);
    }
    // The instance was built on the old bounds.
    animRef.current = null;
  }, [canvasRef, imageLoaded, canvasWidth, canvasHeight, scenePanelId]);

  // ---- helpers ------------------------------------------------------------

  /** Artwork rectangle for this canvas, without distortion. */
  const artworkRect = (canvas: HTMLCanvasElement): RectContenu => {
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

  // Read from the rAF closure, which is not rebuilt on every render.
  const clipsRef = useRef<ClipWindow[]>(clips);
  clipsRef.current = clips;

  const snapshotRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotValidRef = useRef(false);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);

  const bufferCanvas = (
    ref: React.MutableRefObject<HTMLCanvasElement | null>,
    w: number,
    h: number
  ) => {
    let c = ref.current;
    if (!c) {
      c = document.createElement('canvas');
      ref.current = c;
    }
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return c;
  };

  /**
   * Applies the transition ON TOP of the already composed drawing.
   *
   * The incoming side is the BACKGROUND, not the next clip: during the gap,
   * the outgoing clip has finished drawing and the incoming one has nothing
   * to show. The transition therefore reads as "the outgoing one leaves".
   */
  const applyTransition = (
    active: { name: string; t: number },
    ctx: CanvasRenderingContext2D,
    outgoing: HTMLCanvasElement,
    w: number,
    h: number
  ) => {
    const fn = resoudreTransition(active.name);
    if (!fn) return;

    const background = bufferCanvas(backgroundRef, w, h);
    const fctx = background.getContext('2d');
    if (!fctx) return;
    fctx.clearRect(0, 0, w, h);
    paintBackground(fctx, w, h);

    ctx.clearRect(0, 0, w, h);
    fn(ctx, outgoing, background, active.t, w, h);
  };

  /**
   * `target` allows painting ELSEWHERE than on the visible canvas. The seek
   * replay composes into a buffer then blits it: with the visible canvas
   * hard-coded as target, the hand was drawn there, then immediately erased
   * by the copy of the buffer, which stayed empty. So it never showed during a scrub.
   */
  const drawHandSprite = (
    tipX: number,
    tipY: number,
    target?: CanvasRenderingContext2D
  ) => {
    const handCanvas = handCanvasRef.current;
    if (!handCanvas) return;
    const hctx = target ?? handCanvas.getContext('2d');
    if (!hctx) return;

    hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    if (cfgRef.current.handStyle === 'ghost') return;

    const key = normalizeHandKey(cfgRef.current.handStyle);
    const tier = tierForCanvas(
      Math.max(handCanvas.width, handCanvas.height)
    );
    const imgConfig = CUSTOM_HANDS[key]?.images?.[tier];
    // A tier may not be loaded yet: fall back on the 720 one, which loads
    // first, rather than skip the frame and make the hand flicker.
    const sprite =
      handImagesRef.current[`${key}@${tier}`] ??
      handImagesRef.current[`${key}@720`] ??
      handImagesRef.current['custom1@720'];

    if (imgConfig && sprite?.complete) {
      const r = handDrawRect(
        imgConfig,
        tier,
        tipX,
        tipY,
        handCanvas.width,
        handCanvas.height
      );
      hctx.drawImage(sprite, r.x, r.y, r.width, r.height);
    }
  };

  // Static preview when idle at start of clip: clean whiteboard background, no pre-drawn raw image.
  const drawStaticPreview = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintBackground(ctx, canvas.width, canvas.height);
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
  // Ids alone do NOT identify a clip's sequence: every clip carries the same
  // five annotations, so they repeat verbatim from one clip to the next. The
  // reveal times are what differ, each clip sitting at its own offset on the
  // global timeline — without them this key never changes, the engine is never
  // invalidated, and the drawing is never replayed for the new clip.
  const sequenceKey = `${clipOffsetMs}:${annotations
    .map((a) => `${a.id}@${a.reveal.from}:${a.animStyle || ''}`)
    .join('|')}`;
  useEffect(() => {
    animRef.current = null;
    drawingDoneRef.current = false;
    pendingClipResyncRef.current = true;
    // The replay is left to the run loop on purpose. A handover changes this
    // key twice — the clip offset first, the new annotations a render later —
    // and replaying from here rebuilt the engine for both, the first time on
    // the previous scene's annotations (175 ms thrown away). The loop picks
    // the pending flag up once, after both have landed.
  }, [sequenceKey]);

  // Offscreen holds the source artwork the engine reveals from.
  /**
   * The artwork as the engine reveals it: placed on a canvas-sized sheet, its
   * near-white background normalised. Styles only ever read from it, so one
   * sheet per artwork and size is built once and shared by every replay —
   * rebuilding it cost up to 77 ms on each seek and at every scene handover.
   */
  const prepareOffscreen = (img: HTMLImageElement, width: number, height: number) => {
    const key = `${img.src}@${width}x${height}`;
    const cache = offscreenCacheRef.current;
    const cached = cache.get(key);
    if (cached) {
      touch(cache, key, cached);
      return cached;
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const rect = rectContenu(width, height, img.naturalWidth || width, img.naturalHeight || height);
    // willReadFrequently: the sheet is read back (presence map, several styles).
    // A GPU-backed canvas made the first getImageData a full readback — 141 ms
    // measured on a 295×412 region.
    const octx = offscreen.getContext('2d', { willReadFrequently: true });
    octx?.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    // Same normalisation as the server render: without it the preview shows
    // grey rectangles where regions were revealed.
    if (octx) whitenBackground(octx, width, height, rect);
    // Never drawn into again: the engine may cache what it reads from it.
    (offscreen as HTMLCanvasElement & { __immutable?: boolean }).__immutable = true;

    cache.set(key, offscreen);
    if (cache.size > IMAGE_CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return offscreen;
  };

  const ensureOffscreen = (canvas: HTMLCanvasElement) => {
    const offscreen = prepareOffscreen(imageRef.current!, canvas.width, canvas.height);
    offscreenRef.current = offscreen;
    return offscreen;
  };

  /**
   * Builds the sheet of `img` in the worker, where it costs the main thread
   * only a copy. Resolves false when there is no worker or it failed: the
   * caller then lets prepareOffscreen build it here.
   */
  const prepareSheetInWorker = async (img: HTMLImageElement, width: number, height: number) => {
    const key = `${img.src}@${width}x${height}`;
    const cache = offscreenCacheRef.current;
    if (cache.has(key)) return true;
    const worker = getSheetWorker();
    if (!worker) return false;

    const rect = rectContenu(width, height, img.naturalWidth || width, img.naturalHeight || height);
    let prepared: PreparedSheet;
    try {
      prepared = await requestPreparedSheet(worker, key, img, width, height, rect);
    } catch {
      return false;
    }
    const { sheet, map } = prepared;
    // Built on the main thread meanwhile: the engine may already hold that one.
    if (cache.has(key)) {
      sheet.close();
      return true;
    }
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    offscreen.getContext('2d', { willReadFrequently: true })?.drawImage(sheet, 0, 0);
    sheet.close();
    (offscreen as HTMLCanvasElement & { __immutable?: boolean }).__immutable = true;
    seedPresenceMap(offscreen, map);
    cache.set(key, offscreen);
    if (cache.size > IMAGE_CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return true;
  };

  /**
   * Sets the engine clock, and publishes it to the store at most at the
   * PUBLISH_INTERVAL_MS rate.
   *
   * engineTimeRef is ALWAYS written: it is the source of truth for the drawing,
   * the narration and seek detection. The store only needs to be accurate for
   * display — publishing it every frame re-rendered the whole timeline 60
   * times per second.
   *
   * `force` is for moments that must be exact on screen right away:
   * end of the drawing, end of the video, arrival of a seek.
   */
  const publishTime = (ms: number, force = false) => {
    engineTimeRef.current = ms;
    const now = performance.now();
    if (!force && now - lastPublishRef.current < PUBLISH_INTERVAL_MS) return;
    lastPublishRef.current = now;
    lastPublishedPositionRef.current = ms;
    useUnifiedEngineStore.getState().setCurrentTime(ms);
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
    // Filled right after construction: the callbacks re-read from it the
    // current render target, which repositionTo rewires.
    let built: any = null;

    const store = useUnifiedEngineStore.getState();
    const engineState: any = {
      canvasW: canvas.width,
      canvasH: canvas.height,
      // Fixed at faithful 1x: see the comment on ENGINE_DEFAULT_SPEED.
      speed: ENGINE_DEFAULT_SPEED,
      handSpeed,
      hand: normalizeHandKey(handStyle),
      tileSlider: chunks,
      animStyle,
      // The bounds follow the artwork: outside that rectangle there is only
      // background, and the final stamp must not bleed into it.
      contentBounds: artworkRect(canvas),
      // Always in annotation mode: it is the editor's model, not an option.
      // config.useAnnotation remains for saved projects but is no longer read.
      annotations: deriveTimeline(
        sansAttenteInitiale(filterScene(store.animation.annotations, scenePanelIdRef.current)),
      ).annotations,
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
            // The target is re-read from the instance on EVERY call rather
            // than capturing hctx: repositionTo rewires anim.hctx from the
            // buffer to the visible canvas so that resuming after a seek draws
            // on screen. A captured target would stay on the buffer, and the
            // hand would disappear on resume.
            drawHandSprite(tipX, tipY, built?.hctx ?? hctx);
          }
        },
        setProgress: (p: number) => {
          if (stoppedRef.current || seekingRef.current) return;
          const s = useUnifiedEngineStore.getState();
          // p runs over the DRAWING (clip-local 0..localDuration). Scale back
          // to local ms, then add the clip's global offset to get the store
          // time that the narration and the ruler already speak.
          const span = drawingSpanRef.current || s.timeline.duration;
          const localMs = Math.min(1, Math.max(0, p)) * span;
          const globalMs = localMs + clipOffsetMsRef.current;
          publishTime(globalMs);
        },
        finishAnim: () => {
          if (seekingRef.current) {
            stoppedRef.current = true;
            hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
            return;
          }
          // The drawing is done; the video may not be. Retire the engine and
          // hold the finished image — the loop runs the clock out to the end.
          // localSpan is the clip's own duration; the global end is offset + span.
          drawingDoneRef.current = true;
          animRef.current = null;
          hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
          const s = useUnifiedEngineStore.getState();
          const localSpan = drawingSpanRef.current || s.timeline.duration;
          const globalEnd = localSpan + clipOffsetMsRef.current;
          // Forced: the end of the stroke is a moment that must be seen on
          // screen, not at the next publication slot.
          //
          // The REAL position is published, not `globalEnd`. Setting globalEnd
          // pulled the clock forward whenever the stroke finished before the
          // end of its window — measured: jumps of 12 s and 15 s, the last
          // landing at 88161 for a window ending at 88912. Time belongs to
          // the wall clock; finishing the drawing does not move it, it only
          // holds the image until the end.
          publishTime(engineTimeRef.current, true);
          if (globalEnd >= s.timeline.duration - 1) {
            // No narration left to play out: the video ends with the drawing.
            stoppedRef.current = true;
            publishTime(s.timeline.duration, true);
            s.setIsPlaying(false);
          }
        },
        resScale: () => 1,
        resPointScale: () => 1,
      },
    });

    built = anim;
    // With annotations, each region runs its own setup on entry and discards
    // whatever this one built: here it only traced the whole artwork for
    // nothing (22 to 64 ms per replay). Nothing reads the stroke list or the
    // reveal canvas before the first region is entered.
    if (!anim.annotationManager) anim.setup?.();
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
  const seekBufferRef = useRef<HTMLCanvasElement | null>(null);
  const handSeekBufferRef = useRef<HTMLCanvasElement | null>(null);

  const getSeekBuffer = (w: number, h: number) => {
    let buffer = seekBufferRef.current;
    if (!buffer) {
      buffer = document.createElement('canvas');
      seekBufferRef.current = buffer;
    }
    if (buffer.width !== w || buffer.height !== h) {
      buffer.width = w;
      buffer.height = h;
    }
    return buffer;
  };

  const getHandSeekBuffer = (w: number, h: number) => {
    let buffer = handSeekBufferRef.current;
    if (!buffer) {
      buffer = document.createElement('canvas');
      handSeekBufferRef.current = buffer;
    }
    if (buffer.width !== w || buffer.height !== h) {
      buffer.width = w;
      buffer.height = h;
    }
    return buffer;
  };

  /**
   * Repositions the engine without going through the rAF loop.
   *
   * Uses an in-memory buffer canvas to assemble the frame (background, stamped
   * regions and replay) before copying it in a single atomic pass onto the
   * visible canvas. This removes any screen flicker/flash during the drag.
   */
  const repositionTo = (
    targetMs: number,
    canvas: HTMLCanvasElement,
    handCanvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    hctx: CanvasRenderingContext2D
  ) => {
    // The engine always works in clip-local time (0-based). Translate the
    // global store position into the local frame before replaying.
    const localTarget = Math.max(0, targetMs - clipOffsetMsRef.current);
    const offscreen = ensureOffscreen(canvas);

    // Buffer canvas for double-buffering the image and the hand
    const buffer = getSeekBuffer(canvas.width, canvas.height);
    const bctx = buffer.getContext('2d');
    if (!bctx) return;

    const handBuffer = getHandSeekBuffer(handCanvas.width, handCanvas.height);
    const hbctx = handBuffer.getContext('2d');
    if (!hbctx) return;

    bctx.clearRect(0, 0, buffer.width, buffer.height);
    paintBackground(bctx, buffer.width, buffer.height);
    hbctx.clearRect(0, 0, handBuffer.width, handBuffer.height);

    stoppedRef.current = false;
    seekingRef.current = true;
    try {
      const anim = buildEngine(canvas, handCanvas, bctx, hbctx, offscreen);

      // With the engine running at faithful 1x, its clock advances by exactly
      // the delta given: the replay step is therefore the requested ms.
      const advance = (from: number, to: number) => {
        for (let elapsed = from; elapsed < to; elapsed += SEEK_STEP_MS) {
          if (stoppedRef.current) break;
          const slice = Math.min(SEEK_STEP_MS, to - elapsed);
          anim.tick?.(ENGINE_DEFAULT_SPEED, slice);
        }
      };

      // The replay is bounded to ONE region: the image at an annotation
      // boundary is the background plus the previous stamped regions, so it is
      // painted instead of replayed. Otherwise the cost grows with the sought
      // position (134 ms at the end of the timeline on an 11 s scene).
      const plan = planSeek(anim.annotationManager?.schedule, localTarget);
      const artwork = artworkRect(canvas);
      const schedule = anim.annotationManager?.schedule;

      if (plan.stampAll) {
        bctx.drawImage(offscreen, 0, 0);
      } else {
        for (const i of plan.stampRegions) {
          const rect = regionRect(schedule[i].annot.region, artwork);
          if (rect) {
            bctx.drawImage(
              offscreen,
              rect.x, rect.y, rect.w, rect.h,
              rect.x, rect.y, rect.w, rect.h
            );
          }
        }
      }

      anim.primeAt?.(plan.primeAt);
      if (plan.advance) advance(plan.advance.from, plan.advance.to);

      // Rebind the engine's drawing context from the seek buffers back to
      // the visible canvas contexts (ctx and hctx) so that subsequent live ticks during rAF
      // draw directly onto the screen instead of the offscreen buffers.
      anim.ctx = ctx;
      anim.hctx = hctx;
      anim.fillBg = () => paintBackground(ctx, canvas.width, canvas.height);
      animRef.current = stoppedRef.current ? null : anim;
    } catch (err) {
      console.error('Failed to seek animation engine:', err);
      onErrorRef.current('Failed to seek the animation.');
    } finally {
      seekingRef.current = false;
      stoppedRef.current = false;
      // Seeking redefines whether the drawing is behind us: landing before
      // the end of the schedule must let playback rebuild and draw again.
      drawingDoneRef.current =
        drawingSpanRef.current > 0 && localTarget >= drawingSpanRef.current;
    }

    // Atomic copy of both buffers to the display canvases
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(buffer, 0, 0);

    hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    if (!drawingDoneRef.current && !(drawingSpanRef.current > 0 && localTarget >= drawingSpanRef.current)) {
      hctx.drawImage(handBuffer, 0, 0);
    }

    // When scrubbing, no snapshot is needed: the replay has just composed the
    // outgoing clip up to the end of its stroke in `buffer`, which IS the
    // image sought. Without this block, crossing a boundary with the cursor
    // would show no transition.
    const activeTransition = transitionAt(clipsRef.current, targetMs);
    if (activeTransition) {
      applyTransition(activeTransition, ctx, buffer, canvas.width, canvas.height);
      hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    }

    // The store already holds targetMs — it asked for this move.
    // Only the publication slot is reset, so the first playback frame that
    // follows is not held back.
    engineTimeRef.current = targetMs;
    lastPublishRef.current = 0;
    // The engine is now WHERE the store asked: otherwise the gap would remain
    // and the next frame would replay the same repositioning.
    lastPublishedPositionRef.current = targetMs;
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

    // Starting AT THE BEGINNING of a clip is a replay, not a resume. An engine
    // kept from a previous playback would restart where it stopped, whereas
    // the clock has gone back to the start: the stroke would resume from the
    // middle. It is consumed to force the rebuild below.
    {
      const s = useUnifiedEngineStore.getState();
      if (s.timeline.currentTime - clipOffsetMsRef.current <= 0) {
        animRef.current = null;
        drawingDoneRef.current = false;
        engineTimeRef.current = 0;
      }
    }

    // A seek replay reaching the end of the stroke goes through finishAnim,
    // which empties animRef and raises drawingDone. If the current position is
    // BEFORE that end, the drawing is not behind us though: without re-priming,
    // the next block rebuilds nothing and playback runs the clock over a
    // frozen image, with no hand nor progress.
    //
    // Re-prime at the current position rather than letting it rebuild from
    // zero: a fresh engine would restart from the beginning of the stroke
    // while the clock is already in the middle.
    if (!animRef.current && drawingDoneRef.current) {
      const s = useUnifiedEngineStore.getState();
      const local = Math.max(0, s.timeline.currentTime - clipOffsetMsRef.current);
      if (drawingSpanRef.current > 0 && local < drawingSpanRef.current) {
        drawingDoneRef.current = false;
        if (local > 0) {
          repositionTo(s.timeline.currentTime, canvas, handCanvas, ctx, hctx);
        }
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
        onErrorRef.current('Failed to start the animation.');
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

      // Stopping follows the STORE, not the effect cleanup.
      //
      // The click sets isPlaying to false, but React must render first before
      // the cleanup cancels the loop: one or two frames still slipped through
      // in between. At the engine's rate, each one draws a whole batch of
      // strokes — the hand froze, then moved on a little more.
      if (!useUnifiedEngineStore.getState().timeline.isPlaying) {
        // SUSPEND, do not kill. Setting stoppedRef here made the stop final:
        // only an isPlaying change restarts the loop, so a single-frame flip
        // to false — a clip switch, an intermediate render — stopped playback
        // for good. The frame is simply rescheduled without drawing anything;
        // the effect cleanup is what cancels for real.
        last = now;
        frame = requestAnimationFrame(step);
        return;
      }

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
      // The incoming artwork is not ready: hold the last frame while the clock
      // and the narration run on. swapIn raises the resync once it lands.
      if (artworkPendingRef.current) {
        publishTime(engineTimeRef.current + delta);
        hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
        frame = requestAnimationFrame(step);
        return;
      }

      if (pendingClipResyncRef.current) {
        pendingClipResyncRef.current = false;
        repositionTo(s.timeline.currentTime, canvas, handCanvas, ctx, hctx);
      }

      // The playhead can be moved WHILE playing — clicking the ruler, say.
      // currentTime is an INPUT then, not the engine's own output: the engine
      // has to be replayed to the new position, or the very next tick writes
      // the old one back and the click looks like it did nothing.
      if (
        Math.abs(s.timeline.currentTime - lastPublishedPositionRef.current) >
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
        //
        // Advance from engineTimeRef, not from the store: the store is only
        // published 30 times per second, and restarting from its value would
        // lose the delta of unpublished frames — the clock would run slow.
        publishTime(engineTimeRef.current + delta);
        hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
      } else {
        animRef.current?.tick?.(ENGINE_DEFAULT_SPEED, delta);
      }

      // Post-composition. During a gap the engine no longer draws — the block
      // above took the "held image" branch — so the canvas still holds the
      // outgoing clip's last image. It is frozen on the first pass, then
      // repainted from on every frame: without a snapshot, the next frame
      // would fade the result of the previous fade.
      // The clock read here is the ENGINE's, not the store: the fade must
      // start on the frame where the boundary is crossed, not at the next
      // publication slot.
      const activeTransition = transitionAt(clipsRef.current, engineTimeRef.current);
      if (activeTransition) {
        const snap = bufferCanvas(snapshotRef, canvas.width, canvas.height);
        if (!snapshotValidRef.current) {
          const sctx = snap.getContext('2d');
          if (sctx) {
            sctx.clearRect(0, 0, snap.width, snap.height);
            sctx.drawImage(canvas, 0, 0);
          }
          snapshotValidRef.current = true;
        }
        applyTransition(activeTransition, ctx, snap, canvas.width, canvas.height);
        hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
      } else {
        snapshotValidRef.current = false;
      }

      // The narration FOLLOWS the drawing. A track that cannot report a
      // position is left alone rather than allowed to hold up the picture.
      if (manager?.isUsableClock()) {
        // The voice is produced beat by beat: this follow switches to the
        // current chunk. Without it, the switch would wait for the drift to
        // reach the resync threshold, and the silence would be audible. A
        // single track has nothing to follow and ignores it.
        if (audioStarted) manager.follow(engineTimeRef.current);
        if (!audioStarted) {
          // First moment it can actually play. Align it on the drawing, which
          // has been running meanwhile, so a track that took a while to load
          // does not come in behind and then have to be dragged forward.
          if (Math.abs(manager.getCurrentMs() - engineTimeRef.current) > DRIFT_MAX_MS) {
            manager.seekMs(engineTimeRef.current);
          }
          manager.play().catch((err) => {
            console.error('Failed to start audio playback:', err);
            onErrorRef.current('Failed to start audio playback.');
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
      //
      // The end is judged on the ENGINE clock: the store, published at
      // intervals, still holds the position from before this tick.
      if (
        s.timeline.duration > 0 &&
        engineTimeRef.current >= s.timeline.duration - 1
      ) {
        stoppedRef.current = true;
        animRef.current = null;
        publishTime(s.timeline.duration, true);
        hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
        manager?.pause();
        s.setIsPlaying(false);
        return;
      }

      if (!stoppedRef.current) frame = requestAnimationFrame(step);
    };
    // The loop starts in phase with the store: until it has published
    // anything, its starting value is what judges an external seek. Set
    // HERE, after the resets above, otherwise it would hold the previous
    // position and the first frame would think it was a seek.
    lastPublishedPositionRef.current =
      useUnifiedEngineStore.getState().timeline.currentTime;

    frame = requestAnimationFrame(step);

    // Keep animRef so a pause can resume; only cancel the frame loop.
    return () => {
      stoppedRef.current = true;
      cancelAnimationFrame(frame);
      manager?.pause();
      // The last DRAWN frame is the source of truth.
      //
      // The store is published at intervals: on stop it therefore held a
      // position earlier than what the canvas shows. The idle repaint saw a
      // gap there, took it for a user seek, and replayed the engine up to that
      // stale position — the hand jumped to another frame than the one where
      // pause was requested.
      //
      // By force-publishing the real position, the gap falls under the
      // threshold and the repaint does not trigger: the image stays exactly
      // the one being shown.
      publishTime(engineTimeRef.current, true);
    };
  }, [isPlaying, imageLoaded, audioClock.manager]);

  // ---- seek ---------------------------------------------------------------

  // Fixed step used to replay the engine up to the sought position. Style
  // pacing is driven by elapsed time, not by a frame count, so a coarse step
  // lands on the same image as real playback.
  const SEEK_STEP_MS = 33.34;

  /** Delay before the annotation overlay comes back after a scrub. */
  const SCRUB_RETURN_MS = 400;

  /**
   * Minimum interval between two seek replays. A replay rebuilds a whole
   * engine, which costs far more than a frame: issuing one per drag frame
   * saturated the main thread, and the cursor itself became jerky.
   */
  const SEEK_COOLDOWN_MS = 120;

  /** Rect of a region, clamped to the artwork — same computation as _enterRegion. */
  const regionRect = (
    r: any,
    bounds: { x: number; y: number; w: number; h: number }
  ) => {
    const x = Math.max(bounds.x, Math.floor(r.x));
    const y = Math.max(bounds.y, Math.floor(r.y));
    const x2 = Math.min(bounds.x + bounds.w, Math.ceil(r.x + r.width));
    const y2 = Math.min(bounds.y + bounds.h, Math.ceil(r.y + r.height));
    return x2 <= x || y2 <= y ? null : { x, y, w: x2 - x, h: y2 - y };
  };

  // Timeline scrub. Without it currentTime is only an OUTPUT of the engine:
  // nothing repainted, and moving to 0:00.4 left the finished drawing on
  // screen.
  //
  // The image at an annotation BOUNDARY is known in closed form: the engine
  // stamps each region in full before moving to the next, so it is the
  // background plus the previous stamped regions. It is painted directly
  // instead of being cached, then only the current region is animated. The
  // replay is thus bounded by the duration of ONE region instead of growing
  // with the sought position.
  useEffect(() => {
    if (isPlaying || !imageLoaded) return;

    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSeen = useUnifiedEngineStore.getState().timeline.currentTime;

    const onPosition = (currentTime: number) => {
      if (currentTime < 0) return;
      // Write from the engine itself (progress, end of playback): nothing to do.
      if (Math.abs(currentTime - engineTimeRef.current) < 1) return;

      const canvas = canvasRef.current;
      const handCanvas = handCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      const hctx = handCanvas?.getContext('2d');
      if (!canvas || !handCanvas || !ctx || !hctx || !imageRef.current) return;

      setScrubbing(true);
      if (scrubTimer.current) clearTimeout(scrubTimer.current);
      scrubTimer.current = setTimeout(() => setScrubbing(false), SCRUB_RETURN_MS);

      // A drag emits a stream of seeks, and EVERY replay rebuilds a full
      // engine — a style's setup() walks the whole image. One is kept per
      // SEEK_COOLDOWN_MS window: the first fires right away, the next ones
      // wait for the window to end, and the last position is always replayed.
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      const launch = () => {
        lastSeekAtRef.current = performance.now();
        raf = requestAnimationFrame(() => {
          // The artwork effect repaints at the playhead once it lands.
          if (artworkPendingRef.current) return;
          repositionTo(currentTime, canvas, handCanvas, ctx, hctx);
        });
      };
      const remaining = SEEK_COOLDOWN_MS - (performance.now() - lastSeekAtRef.current);
      if (remaining <= 0) launch();
      else timer = setTimeout(launch, remaining);
    };

    const unsubscribe = useUnifiedEngineStore.subscribe((state) => {
      const t = state.timeline.currentTime;
      if (t === lastSeen) return;
      lastSeen = t;
      onPosition(t);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [isPlaying, imageLoaded]);

  // Static preview at the START OF THE CLIP (nothing revealed yet, or Reset).
  //
  // The criterion is the clip-LOCAL time, not the global position. The
  // original guard compared currentTime to 0: at the start of the second clip
  // it is already several thousand ms, so the preview withdrew and nothing
  // painted the illustration anymore — annotations floated over an empty canvas.
  //
  // Past that start there is no repaint: a paused playback must keep its
  // revealed image, and be able to resume where it was.
  useEffect(() => {
    if (isPlaying) return;
    // During a scrub the seek does the painting: moving the cursor must show
    // where the drawing stands. Control is taken back once it settles, hence
    // scrubbing in the deps — the same delay as the overlay's return.
    if (scrubbing) return;

    const showPreviewIfAtStart = (currentTime: number) => {
      if (currentTime - clipOffsetMsRef.current > 0) return;
      animRef.current = null;
      drawingDoneRef.current = false;
      engineTimeRef.current = 0;
      const handCanvas = handCanvasRef.current;
      handCanvas
        ?.getContext('2d')
        ?.clearRect(0, 0, handCanvas.width, handCanvas.height);
      drawStaticPreview();
    };

    let lastSeen = useUnifiedEngineStore.getState().timeline.currentTime;
    showPreviewIfAtStart(lastSeen);
    return useUnifiedEngineStore.subscribe((state) => {
      const t = state.timeline.currentTime;
      if (t === lastSeen) return;
      lastSeen = t;
      showPreviewIfAtStart(t);
    });
  }, [
    isPlaying,
    scrubbing,
    imageLoaded,
    artworkVersion,
    canvasBg,
    canvasRef,
    handCanvasRef,
    imageUrl,
  ]);

  // Repaint on the ARRIVAL of the illustration while stopped.
  //
  // It is set asynchronously, and for any clip placed after 0 nothing painted
  // it: the static preview above withdraws as soon as currentTime > 0, and the
  // seek does not re-trigger — its engineTimeRef guard sees an unchanged
  // position, and imageLoaded only flips for the FIRST illustration. The
  // canvas therefore kept the previous clip's one, or nothing, under an
  // annotation overlay visible again: the frames floated with no drawing.
  //
  // applyImage has just emptied animRef and offscreenRef: there is no ongoing
  // animation state to preserve here.
  // The illustration version ALREADY repainted. `isPlaying` is in the
  // dependencies to wait for the stop when the illustration arrives mid
  // playback — but without this mark, every PAUSE re-ran the repaint. The
  // replay proceeds by fixed steps and does not land back on the stroke point
  // where live playback stopped: the hand jumped elsewhere and the drawing
  // moved on, at the very moment the image was asked to freeze.
  const repaintedVersionRef = useRef(0);
  useEffect(() => {
    if (artworkVersion === 0 || isPlaying) return;
    if (repaintedVersionRef.current === artworkVersion) return;
    // The start of the clip is covered by the static preview, which now
    // follows artworkVersion. All that remains here is an illustration replaced
    // WHILE already into the clip: the reveal must then be replayed to show
    // it at the right stage.
    const currentTime = useUnifiedEngineStore.getState().timeline.currentTime;
    if (currentTime - clipOffsetMsRef.current <= 0) return;

    const canvas = canvasRef.current;
    const handCanvas = handCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const hctx = handCanvas?.getContext('2d');
    if (!canvas || !handCanvas || !ctx || !hctx || !imageRef.current) return;

    if (artworkPendingRef.current) return;
    repaintedVersionRef.current = artworkVersion;
    repositionTo(currentTime, canvas, handCanvas, ctx, hctx);
    // currentTime out of the deps: repaint when the illustration changes, not
    // on every clock tick — the scrub above already handles that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artworkVersion, isPlaying]);

  // ---- annotation overlay -------------------------------------------------

  // The overlay is an EDITING aid: it hides the drawing one came to watch.
  // So it fades out as soon as anything moves — playback or scrub — and comes
  // back when stopped, end of playback included.
  //
  // Exposed because the Konva overlay (AnnotationOverlay), which replaces the
  // imperative drawing below on the editor surface, must hide at exactly the
  // same moments.
  const isOverlayHidden = isPlaying || scrubbing;

  useEffect(() => {
    const annCanvas = annotationCanvasRef?.current;
    if (!annCanvas) return;

    const actx = annCanvas.getContext('2d');
    if (!actx) return;

    const hidden = isOverlayHidden;
    annCanvas.style.opacity = hidden ? '0' : '1';

    actx.clearRect(0, 0, annCanvas.width, annCanvas.height);
    if (hidden || annotations.length === 0) return;

    annotations.forEach((annot, i) => {
      const region = annot.region;
      if (!region) return;

      const { stroke, fill } = annotationColors(annot, i);

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

  // isScrubbing is returned because moving the cursor is not only a rendering
  // matter: crossing a clip boundary changes the active clip, and the caller
  // must not reposition the playhead under the fingers of whoever is scrubbing.
  return { isOverlayHidden, isScrubbing: scrubbing, isPreparingArtwork: artworkPendingRef.current };
}
