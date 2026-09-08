'use client';

import { useEffect, useRef, useState } from 'react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import * as selectors from '@/lib/unified-engine/hooks/selectors';
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
const { blanchirFond } = require('../lib/fond-blanc');

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

/** Nombre d'images decodees gardees en cache, au-dela duquel la plus vieille cede sa place. */
const IMAGE_CACHE_MAX = 12;

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
 * Cadence de PUBLICATION de l'horloge dans le store.
 *
 * Le moteur avance a chaque frame, mais chaque ecriture de currentTime rend
 * tous les abonnes — la timeline entiere, ses regles, ses pistes. A 60 Hz le
 * rendu React coutait plus cher que le dessin lui-meme. L'horloge REELLE reste
 * engineTimeRef, mise a jour a chaque tick : seule sa publication est ralentie,
 * donc rien ne derive. Doit rester nettement sous EXTERNAL_SEEK_MS, sans quoi
 * le retard de publication passerait pour un deplacement du curseur.
 */
const PUBLISH_INTERVAL_MS = 1000 / 30;

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
  /**
   * La voix produite temps par temps. Elle prime sur `audioUrl`, qui reste le
   * chemin d'une piste televersee et celui des projets anterieurs.
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
   * Sequence complete, pour savoir ou tombent les blancs entre clips.
   * clipOffsetMs reste par ailleurs inchange : il designe le clip ACTIF et sert
   * a passer de l'horloge globale a l'horloge locale du moteur.
   */
  clips?: ClipWindow[];
  /**
   * Un echec que l'utilisateur doit voir : image introuvable, moteur qui ne
   * demarre pas, lecture audio refusee par le navigateur. Sans ce canal, ces
   * echecs partaient uniquement en `console.error` — l'ecran restait blanc
   * ou silencieux sans que rien n'explique pourquoi.
   */
  onError?: (message: string) => void;
}

const NOOP_ON_ERROR = (_message: string) => {};

export function useWhiteboardRenderer({
  canvasRef,
  canvasWidth,
  canvasHeight,
  handCanvasRef,
  annotationCanvasRef,
  imageUrl = null,
  audioUrl = null,
  narrationParts = AUCUNE_PART as NarrationPart[],
  audioVolume = 1,
  audioMuted = false,
  audioDurationMs = null,
  savedAnnotations = null,
  clipOffsetMs = 0,
  clips = [],
  onError = NOOP_ON_ERROR,
}: UseWhiteboardRendererProps) {
  // Toujours la derniere fonction recue, sans rentrer dans les dependances
  // des effets qui l'appellent : un composant qui passe une closure inline
  // en ferait une nouvelle a chaque rendu, et chaque effet se relancerait.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  // `progress` n'est lu nulle part dans ce hook : l'inclure abonnait le
  // composant a une valeur derivee de currentTime, recalculee et comparee
  // pour rien 60 fois par seconde. `currentTime` reste necessaire — la
  // detection de scrub plus bas en depend — donc ce hook continue de
  // re-rendre a chaque tick pendant la lecture ; seul `progress` disparait.
  const {
    isPlaying,
    currentTime,
    canvasBg,
    animStyle,
    handStyle,
    handSpeed,
    chunks,
  } = useUnifiedEngine<{
    isPlaying: boolean;
    currentTime: number;
    canvasBg: string;
    animStyle: string;
    handStyle: string;
    handSpeed: number | undefined;
    chunks: number | undefined;
  }>((state) => ({
    isPlaying: selectors.selectIsPlaying(state),
    currentTime: selectors.selectCurrentTime(state),
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
  // Une image deja decodee, par URL : revenir sur un clip deja vu ne doit ni
  // la retelecharger ni la redecoder. Borne pour qu'une session tres longue
  // n'accumule pas indefiniment des HTMLImageElement decodes.
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
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
  // Instant de la derniere PUBLICATION dans le store, cf. PUBLISH_INTERVAL_MS.
  const lastPublishRef = useRef(0);
  // La POSITION portee par la derniere publication — la derniere valeur que le
  // moteur a lui-meme ecrite dans le store.
  //
  // C'est elle, et non l'horloge courante du moteur, qui dit si le store a ete
  // change par QUELQU'UN D'AUTRE. Le store est publie a intervalle : entre deux
  // publications il retarde par construction, et comparer l'horloge courante a
  // ce retard normal faisait prendre la lenteur du rendu pour un clic sur la
  // reglette. Le moteur se replacait alors sur une valeur perimee, a chaque
  // frame trop longue — la lecture reculait sans jamais avancer.
  const dernierePositionPublieeRef = useRef(0);
  // Instant du dernier rejeu de seek, cf. SEEK_COOLDOWN_MS.
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
  // Incremente a CHAQUE illustration posee, la premiere comprise. imageLoaded ne
  // bascule que pour la premiere (voir le chargement plus bas) : sans ce
  // compteur, l'arrivee d'une illustration de clip suivant ne reveille aucun
  // effet, l'image etant portee par une ref.
  const [artworkVersion, setArtworkVersion] = useState(0);
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

  // Global offset of this clip on the narration clock. Kept in a ref so the
  // rAF closure always reads the current clip without a dependency on
  // clipOffsetMs that would tear down and restart the loop on every clip change.
  const clipOffsetMsRef = useRef(0);
  clipOffsetMsRef.current = clipOffsetMs;

  // ---- assets -------------------------------------------------------------

  // Preload hand sprites ONCE on mount so clip switches don't re-instantiate
  // 16 Image objects and trigger redundant asset requests.
  useEffect(() => {
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

  useEffect(() => {
    const targetSrc = imageUrl || SCENE_IMAGE;

    // Deja affichee a l'identique : rien a refaire. Sans ce court-circuit,
    // revenir sur un clip deja vu recreait un Image(), la redecodait, et
    // invalidait le moteur (offscreen, instance d'animation) pour un artwork
    // strictement inchange.
    if (
      imageRef.current &&
      imageRef.current.src === targetSrc &&
      imageRef.current.complete &&
      imageRef.current.naturalWidth > 0
    ) {
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

    let cancelled = false;

    const applyImage = (loadedImg: HTMLImageElement) => {
      if (cancelled) return;
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

    const remember = (loadedImg: HTMLImageElement) => {
      const cache = imageCacheRef.current;
      cache.set(targetSrc, loadedImg);
      if (cache.size > IMAGE_CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
    };

    // Un clip deja visite plus tot dans la session (A -> B -> A) retrouve son
    // element deja decode, sans nouvelle requete ni nouveau decodage.
    const cached = imageCacheRef.current.get(targetSrc);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      applyImage(cached);
      return () => {
        cancelled = true;
      };
    }

    const img = new Image();
    // Le moteur revele le dessin en LISANT les pixels du canvas
    // (`getImageData`). Sans cet attribut, une image servie par le bac — donc
    // par une autre origine — teinte le canvas, et la lecture leve une
    // SecurityError qui empeche l'animation de demarrer. Le bac repond en
    // CORS ; il suffit de le demander.
    img.crossOrigin = 'anonymous';
    img.src = targetSrc;

    if (img.complete && img.naturalWidth > 0) {
      remember(img);
      applyImage(img);
    } else {
      img.onload = () => {
        remember(img);
        applyImage(img);
      };
      img.onerror = () => {
        console.error('Failed to load scene image', targetSrc);
        onErrorRef.current('Failed to load the image for this clip.');
      };
    }

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

  // Lue depuis la closure rAF, qui ne se reconstruit pas a chaque rendu.
  const clipsRef = useRef<ClipWindow[]>(clips);
  clipsRef.current = clips;

  const snapshotRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotValideRef = useRef(false);
  const fondRef = useRef<HTMLCanvasElement | null>(null);

  const canvasTampon = (
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
   * Applique la transition PAR-DESSUS le dessin deja compose.
   *
   * Le cote entrant est le FOND, pas le clip suivant : pendant le blanc, le
   * sortant a fini de tracer et l'entrant n'a rien a montrer. La transition lit
   * donc « le sortant s'en va ».
   */
  const appliquerTransition = (
    active: { name: string; t: number },
    ctx: CanvasRenderingContext2D,
    sortante: HTMLCanvasElement,
    w: number,
    h: number
  ) => {
    const fn = resoudreTransition(active.name);
    if (!fn) return;

    const fond = canvasTampon(fondRef, w, h);
    const fctx = fond.getContext('2d');
    if (!fctx) return;
    fctx.clearRect(0, 0, w, h);
    paintBackground(fctx, w, h);

    ctx.clearRect(0, 0, w, h);
    fn(ctx, sortante, fond, active.t, w, h);
  };

  /**
   * `target` permet de peindre AILLEURS que sur le canvas visible. Le rejeu de
   * seek compose dans un tampon puis le blitte : en visant le canvas visible en
   * dur, la main y etait bien dessinee, puis aussitot effacee par la copie du
   * tampon reste vide. Elle ne s'affichait donc jamais pendant un scrub.
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
    // Rebuild here rather than leaving it to the next animation frame. Handing
    // it to the loop cost a whole frame of dead time — a visible pause before
    // the new clip started drawing — for no benefit: the store already holds
    // the new sequence by the time this effect runs.
    const canvas = canvasRef.current;
    const handCanvas = handCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const hctx = handCanvas?.getContext('2d');
    const s = useUnifiedEngineStore.getState();
    if (canvas && handCanvas && ctx && hctx && imageRef.current && s.timeline.isPlaying) {
      pendingClipResyncRef.current = false;
      repositionTo(s.timeline.currentTime, canvas, handCanvas, ctx, hctx);
    }
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
    const octx = offscreen.getContext('2d');
    octx?.drawImage(imageRef.current!, rect.x, rect.y, rect.w, rect.h);
    // Meme normalisation qu'au rendu serveur : sans elle l'apercu montre des
    // rectangles gris la ou les regions ont ete revelees.
    if (octx) blanchirFond(octx, offscreen.width, offscreen.height);
    return offscreen;
  };

  /**
   * Pose l'horloge du moteur, et la publie dans le store au plus a la cadence
   * de PUBLISH_INTERVAL_MS.
   *
   * engineTimeRef est TOUJOURS ecrit : c'est lui qui fait foi pour le dessin,
   * la narration et la detection de seek. Le store, lui, n'a besoin d'etre
   * juste que pour l'affichage — le publier a chaque frame rendait toute la
   * timeline 60 fois par seconde.
   *
   * `force` sert aux instants qui doivent etre exacts a l'ecran tout de suite :
   * fin du dessin, fin de la video, arrivee d'un seek.
   */
  const publishTime = (ms: number, force = false) => {
    engineTimeRef.current = ms;
    const now = performance.now();
    if (!force && now - lastPublishRef.current < PUBLISH_INTERVAL_MS) return;
    lastPublishRef.current = now;
    dernierePositionPublieeRef.current = ms;
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
    // Renseigne juste apres la construction : les callbacks y relisent la cible
    // de rendu courante, que repositionTo rebranche.
    let built: any = null;

    const store = useUnifiedEngineStore.getState();
    const engineState: any = {
      canvasW: canvas.width,
      canvasH: canvas.height,
      // Fige au 1x fidele : voir le commentaire de ENGINE_DEFAULT_SPEED.
      speed: ENGINE_DEFAULT_SPEED,
      handSpeed,
      hand: normalizeHandKey(handStyle),
      tileSlider: chunks,
      animStyle,
      // Les bornes suivent l'artwork : hors de ce rectangle il n'y a que du
      // fond, et le tampon de fin ne doit pas y baver.
      contentBounds: rectArtwork(canvas),
      // Toujours en mode annotation : c'est le modele de l'editeur, pas une
      // option. config.useAnnotation subsiste pour les projets enregistres
      // mais n'est plus lu.
      annotations: deriveTimeline(
        sansAttenteInitiale(store.animation.annotations),
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
            // On relit la cible sur l'instance a CHAQUE appel plutot que de
            // capturer hctx : repositionTo rebranche anim.hctx du tampon vers
            // le canvas visible pour que la reprise apres un seek dessine a
            // l'ecran. Une cible capturee resterait sur le tampon, et la main
            // disparaitrait a la reprise.
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
          // Force : la fin du trace est un instant qu'on doit voir a l'ecran,
          // pas au prochain creneau de publication.
          publishTime(globalEnd, true);
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
   * Repositionne le moteur sans passer par la boucle rAF.
   *
   * Utilise un canvas buffer en memoire pour assembler la frame (fond, regions
   * tamponnees et rejeu) avant de la copier en une seule passe atomique sur le
   * canvas visible. Cela elimine tout clignotement/flash d'ecran pendant le drag.
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

    // Buffer canvas pour le double-buffering de l'image et de la main
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

      // Le moteur tournant au 1x fidele, son horloge avance exactement du
      // delta fourni : le pas du rejeu est donc la ms demandee.
      const advance = (from: number, to: number) => {
        for (let elapsed = from; elapsed < to; elapsed += SEEK_STEP_MS) {
          if (stoppedRef.current) break;
          const slice = Math.min(SEEK_STEP_MS, to - elapsed);
          anim.tick?.(ENGINE_DEFAULT_SPEED, slice);
        }
      };

      // Le rejeu est borne a UNE region : l'image a la frontiere d'une
      // annotation est le fond plus les regions precedentes estampillees, on la
      // peint au lieu de la rejouer. Sans cela le cout croit avec la position
      // cherchee (134 ms en bout de timeline sur une scene de 11 s).
      const plan = planSeek(anim.annotationManager?.schedule, localTarget);
      const artwork = rectArtwork(canvas);
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

    // Copie atomique des deux buffers vers les canvas d'affichage
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(buffer, 0, 0);

    hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    if (!drawingDoneRef.current && !(drawingSpanRef.current > 0 && localTarget >= drawingSpanRef.current)) {
      hctx.drawImage(handBuffer, 0, 0);
    }

    // Au scrub, pas besoin d'instantane : le rejeu vient de composer le clip
    // sortant jusqu'a la fin de son trace dans `buffer`, ce qui EST l'image
    // recherchee. Sans ce bloc, traverser une frontiere au curseur ne montrerait
    // aucune transition.
    const enTransition = transitionAt(clipsRef.current, targetMs);
    if (enTransition) {
      appliquerTransition(enTransition, ctx, buffer, canvas.width, canvas.height);
      hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    }

    // Le store porte deja targetMs — c'est lui qui a demande ce deplacement.
    // Seul le creneau de publication est reamorce, pour que la premiere frame
    // de lecture qui suit ne soit pas retenue.
    engineTimeRef.current = targetMs;
    lastPublishRef.current = 0;
    // Le moteur est desormais LA ou le store le demandait : sans cela l'ecart
    // subsisterait et la frame suivante rejouerait le meme replacement.
    dernierePositionPublieeRef.current = targetMs;
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

    // Demarrer AU DEBUT d'un clip est un rejeu, pas une reprise. Un moteur
    // conserve d'une lecture precedente redemarrerait la ou il s'etait arrete,
    // alors que l'horloge, elle, est revenue au debut : le trace repartirait
    // du milieu. On le consomme pour forcer la reconstruction plus bas.
    {
      const s = useUnifiedEngineStore.getState();
      if (s.timeline.currentTime - clipOffsetMsRef.current <= 0) {
        animRef.current = null;
        drawingDoneRef.current = false;
        engineTimeRef.current = 0;
      }
    }

    // Un rejeu de seek atteignant la fin du trace passe par finishAnim, qui
    // vide animRef et leve drawingDone. Si la position courante est EN DECA de
    // cette fin, le dessin n'est pourtant pas derriere nous : sans reamorcage
    // le bloc suivant ne reconstruit rien et la lecture fait tourner l'horloge
    // sur une image figee, sans main ni progression.
    //
    // On reamorce a la position courante plutot que de laisser reconstruire
    // depuis zero : un moteur neuf repartirait du debut du trace alors que
    // l'horloge, elle, est deja au milieu.
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

      // L'arret suit le STORE, pas le nettoyage de l'effet.
      //
      // Le clic pose isPlaying a faux, mais React doit d'abord se rendre avant
      // que le nettoyage n'annule la boucle : une ou deux frames passaient
      // encore entre les deux. A la cadence du moteur, chacune trace tout un
      // paquet de traits — la main se figeait, puis avancait encore un peu.
      if (!useUnifiedEngineStore.getState().timeline.isPlaying) {
        // On SUSPEND, on ne tue pas. Poser stoppedRef ici rendait l'arret
        // definitif : seul un changement de isPlaying relance la boucle, donc
        // un passage a faux d'une seule frame — une bascule de clip, un rendu
        // intermediaire — arretait la lecture pour de bon. La frame est
        // simplement replanifiee sans rien dessiner ; c'est le nettoyage de
        // l'effet qui annule pour de vrai.
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
        Math.abs(s.timeline.currentTime - dernierePositionPublieeRef.current) >
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
        // On avance depuis engineTimeRef, pas depuis le store : celui-ci n'est
        // publie que 30 fois par seconde, et repartir de sa valeur perdrait le
        // delta des frames non publiees — l'horloge avancerait au ralenti.
        publishTime(engineTimeRef.current + delta);
        hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
      } else {
        animRef.current?.tick?.(ENGINE_DEFAULT_SPEED, delta);
      }

      // Post-composition. Pendant un blanc le moteur ne dessine plus — le bloc
      // ci-dessus a pris la branche « image tenue » — donc le canvas porte
      // encore la derniere image du clip sortant. On la fige au premier passage,
      // puis on repeint depuis elle a chaque frame : sans instantane, la frame
      // suivante fondrait le resultat du fondu precedent.
      // L'horloge lue ici est celle du MOTEUR, pas le store : le fondu doit
      // demarrer a la frame ou la frontiere est franchie, pas au prochain
      // creneau de publication.
      const enTransition = transitionAt(clipsRef.current, engineTimeRef.current);
      if (enTransition) {
        const snap = canvasTampon(snapshotRef, canvas.width, canvas.height);
        if (!snapshotValideRef.current) {
          const sctx = snap.getContext('2d');
          if (sctx) {
            sctx.clearRect(0, 0, snap.width, snap.height);
            sctx.drawImage(canvas, 0, 0);
          }
          snapshotValideRef.current = true;
        }
        appliquerTransition(enTransition, ctx, snap, canvas.width, canvas.height);
        hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
      } else {
        snapshotValideRef.current = false;
      }

      // The narration FOLLOWS the drawing. A track that cannot report a
      // position is left alone rather than allowed to hold up the picture.
      if (manager?.isUsableClock()) {
        // La voix est produite temps par temps : ce suivi bascule sur le
        // morceau du moment. Sans lui, la bascule attendrait que la derive
        // atteigne le seuil de recalage, et le silence s'entendrait. Une
        // piste unique n'a rien a suivre et l'ignore.
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
      // La fin se juge sur l'horloge du MOTEUR : le store, publie a intervalle,
      // porte encore la position d'avant ce tick.
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
    // La boucle demarre en phase avec le store : tant qu'elle n'y a rien publie,
    // c'est sa valeur d'entree qui fait foi pour juger d'un seek exterieur. Pose
    // ICI, apres les remises a zero ci-dessus, sinon elle porterait la position
    // d'avant et la premiere frame croirait a un seek.
    dernierePositionPublieeRef.current =
      useUnifiedEngineStore.getState().timeline.currentTime;

    frame = requestAnimationFrame(step);

    // Keep animRef so a pause can resume; only cancel the frame loop.
    return () => {
      stoppedRef.current = true;
      cancelAnimationFrame(frame);
      manager?.pause();
      // La derniere frame DESSINEE fait foi.
      //
      // Le store est publie a intervalle : a l'arret il portait donc une
      // position anterieure a ce que le canvas montre. Le repeint d'inactivite
      // y voyait un ecart, le prenait pour un seek de l'utilisateur, et
      // rejouait le moteur jusqu'a cette position perimee — la main sautait
      // sur une autre frame que celle ou la pause avait ete demandee.
      //
      // En publiant de force la position reelle, l'ecart tombe sous le seuil
      // et le repeint ne se declenche pas : l'image reste exactement celle
      // qu'on voyait.
      publishTime(engineTimeRef.current, true);
    };
  }, [isPlaying, imageLoaded, audioClock.manager]);

  // ---- seek ---------------------------------------------------------------

  // Pas fixe utilise pour rejouer le moteur jusqu'a la position cherchee. La
  // cadence des styles est pilotee par le temps ecoule et non par un nombre de
  // frames, donc un pas grossier tombe sur la meme image que la lecture reelle.
  const SEEK_STEP_MS = 33.34;

  /** Delai avant que le calque d'annotations ne revienne apres un scrub. */
  const SCRUB_RETOUR_MS = 400;

  /**
   * Palier minimal entre deux rejeux de seek. Un rejeu reconstruit un moteur
   * entier, ce qui coute bien plus qu'une frame : en emettre un par frame de
   * drag saturait le fil principal, et le curseur lui-meme devenait saccade.
   */
  const SEEK_COOLDOWN_MS = 120;

  /** Rect d'une region, borne a l'artwork — meme calcul que _enterRegion. */
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
    if (currentTime < 0) return;
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

    // Un drag emet un flot de seeks, et CHAQUE rejeu reconstruit un moteur
    // complet — le setup() d'un style parcourt l'image entiere. Un par frame
    // depassait donc largement le budget d'une frame et le curseur devenait
    // pateux. On en garde un par palier de SEEK_COOLDOWN_MS : le premier part
    // tout de suite (le retour visuel reste immediat), les suivants attendent
    // la fin du palier. La derniere position est toujours rejouee, l'effet
    // n'etant plus rappele apres elle.
    let raf = 0;
    const lancer = () => {
      lastSeekAtRef.current = performance.now();
      raf = requestAnimationFrame(() => {
        repositionTo(currentTime, canvas, handCanvas, ctx, hctx);
      });
    };

    const reste = SEEK_COOLDOWN_MS - (performance.now() - lastSeekAtRef.current);
    if (reste <= 0) {
      lancer();
      return () => cancelAnimationFrame(raf);
    }

    const timer = setTimeout(lancer, reste);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [currentTime, isPlaying, imageLoaded]);

  // Apercu statique au DEBUT DU CLIP (rien de revele encore, ou Reset).
  //
  // Le critere est le temps LOCAL au clip, pas la position globale. Le garde
  // d'origine comparait currentTime a 0 : au debut du deuxieme clip il vaut
  // deja plusieurs milliers de ms, l'apercu se retirait donc et plus rien ne
  // peignait l'illustration — les annotations flottaient sur un canvas vide.
  //
  // Au-dela de ce debut on ne repeint pas : une lecture mise en pause doit
  // garder son image revelee, et pouvoir reprendre la ou elle en etait.
  useEffect(() => {
    if (isPlaying) return;
    // Pendant un scrub c'est le seek qui peint : deplacer le curseur doit
    // montrer ou en est le dessin. On reprend la main quand il se calme, d'ou
    // scrubbing dans les deps — le meme delai que le retour du calque.
    if (scrubbing) return;

    const local = currentTime - clipOffsetMsRef.current;
    if (local > 0) return;

    animRef.current = null;
    drawingDoneRef.current = false;
    engineTimeRef.current = 0;
    const handCanvas = handCanvasRef.current;
    handCanvas
      ?.getContext('2d')
      ?.clearRect(0, 0, handCanvas.width, handCanvas.height);
    drawStaticPreview();
  }, [
    isPlaying,
    scrubbing,
    currentTime,
    imageLoaded,
    artworkVersion,
    canvasBg,
    canvasRef,
    handCanvasRef,
    imageUrl,
  ]);

  // Repeint a l'ARRIVEE de l'illustration quand on est a l'arret.
  //
  // Elle est posee de facon asynchrone, et pour tout clip place apres 0 rien ne
  // la peignait : l'apercu statique ci-dessus se retire des que currentTime > 0,
  // et le seek ne se redeclenche pas — son garde engineTimeRef voit une position
  // inchangee, et imageLoaded ne bascule que pour la PREMIERE illustration. Le
  // canvas gardait donc celle du clip precedent, ou rien, sous un calque
  // d'annotations redevenu visible : les cadres flottaient sans dessin.
  //
  // applyImage vient de vider animRef et offscreenRef : il n'y a aucun etat
  // d'animation en cours a preserver ici.
  // La version d'illustration DEJA repeinte. `isPlaying` figure dans les
  // dependances pour attendre l'arret quand l'illustration arrive en pleine
  // lecture — mais sans cette marque, chaque PAUSE relancait le repeint. Le
  // rejeu procede par pas fixes et ne retombe pas sur le point du trace ou la
  // lecture en direct s'etait arretee : la main sautait ailleurs et le dessin
  // avancait, a l'instant meme ou l'on demandait a figer l'image.
  const versionRepeinteRef = useRef(0);
  useEffect(() => {
    if (artworkVersion === 0 || isPlaying) return;
    if (versionRepeinteRef.current === artworkVersion) return;
    // Le debut de clip est couvert par l'apercu statique, qui suit desormais
    // artworkVersion. Ne reste ici que le cas d'une illustration remplacee
    // ALORS qu'on est deja engage dans le clip : il faut alors rejouer le
    // reveal pour la montrer a la bonne etape.
    if (currentTime - clipOffsetMsRef.current <= 0) return;

    const canvas = canvasRef.current;
    const handCanvas = handCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const hctx = handCanvas?.getContext('2d');
    if (!canvas || !handCanvas || !ctx || !hctx || !imageRef.current) return;

    versionRepeinteRef.current = artworkVersion;
    repositionTo(currentTime, canvas, handCanvas, ctx, hctx);
    // currentTime hors des deps : on repeint quand l'illustration change, pas a
    // chaque tick d'horloge — le scrub ci-dessus s'en charge deja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artworkVersion, isPlaying]);

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

  // isScrubbing sort d'ici parce que le deplacement du curseur n'est pas qu'une
  // affaire de rendu : franchir une frontiere de clip change le clip actif, et
  // l'appelant ne doit pas replacer la tete de lecture sous les doigts de qui
  // scrube.
  return { isOverlayHidden, isScrubbing: scrubbing };
}
