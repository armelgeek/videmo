'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ellipsePath, type Mark } from './capture';

/**
 * Les styles tels que le moteur les connait : `id` est la valeur passee a
 * AnimationFactory, pas une etiquette marketing. Une carte qui annonce un style
 * introuvable enverrait l'utilisateur vers un rendu en chunkjump sans le dire.
 */
export interface AnimationStyleCard {
  id: string;
  label: string;
  description: string;
  tier: 'free' | 'premium';
  marks: Mark[];
}

export const ANIMATION_STYLES: AnimationStyleCard[] = [
  {
    id: 'chunkjump',
    label: 'Chunk Jump',
    description: 'Block by block, the hand jumping to each new one.',
    tier: 'free',
    marks: [
      { x: 44, y: 35, w: 14, h: 12, label: 'hand jumps block to block', side: 'above' },
      { x: 23, y: 81, w: 24, h: 13, label: 'draws element by element', side: 'below' },
    ],
  },
  {
    id: 'contour',
    label: 'Contour',
    description: 'Every outline traced first, shapes settle in after.',
    tier: 'free',
    marks: [
      { x: 33, y: 20, w: 34, h: 43, label: 'every outline traced first', side: 'above' },
      { x: 53, y: 81, w: 24, h: 13, label: 'colour fills settle in after', side: 'below' },
    ],
  },
  {
    id: 'scanner',
    label: 'Scanner',
    description: 'A band sweeps across and leaves the artwork behind it.',
    tier: 'free',
    marks: [
      { x: 20, y: 25, w: 60, h: 42, label: 'horizontal sweep reveals art', side: 'above' },
      { x: 34, y: 81, w: 32, h: 13, label: 'clean scanning wipe', side: 'below' },
    ],
  },
  {
    id: 'outlineonly',
    label: 'Outline Only',
    description: 'Line work alone, no colour fill.',
    tier: 'free',
    marks: [
      { x: 34, y: 21, w: 32, h: 42, label: 'pure stroke line work', side: 'above' },
      { x: 45, y: 60, w: 10, h: 14, label: 'zero colour fill', side: 'below' },
    ],
  },
  {
    id: 'illustfill',
    label: 'Illustration',
    description: 'Outline by hand, then every colour laid in.',
    tier: 'premium',
    marks: [
      { x: 33, y: 20, w: 34, h: 43, label: 'outline inked by hand', side: 'above' },
      { x: 23, y: 81, w: 54, h: 13, label: 'every hue painted in place', side: 'below' },
    ],
  },
  {
    id: 'outlinefill',
    label: 'Outline Fill',
    description: 'Outline first, then colour sweeps in from the top.',
    tier: 'premium',
    marks: [
      { x: 33, y: 20, w: 34, h: 43, label: 'outline traced first', side: 'above' },
      { x: 53, y: 81, w: 24, h: 13, label: 'ink sweeps from top down', side: 'below' },
    ],
  },
  {
    id: 'brushfill',
    label: 'Brush Fill',
    description: 'Hatched strokes on small areas, one angled sweep on large ones.',
    tier: 'premium',
    marks: [
      { x: 44, y: 36, w: 13, h: 12, label: 'hatched strokes on details', side: 'above' },
      { x: 23, y: 81, w: 54, h: 13, label: 'angled brush sweep across flats', side: 'below' },
    ],
  },
  {
    id: 'outlinechunks',
    label: 'Outline Chunks',
    description: 'Outlines arrive in pieces, never one continuous line.',
    tier: 'premium',
    marks: [
      { x: 34, y: 21, w: 32, h: 42, label: 'strokes arrive in fragments', side: 'above' },
      { x: 44, y: 60, w: 12, h: 14, label: 'never one long line', side: 'below' },
    ],
  },
  {
    id: 'scribble',
    label: 'Scribble',
    description: 'Loose scribbled strokes that fill as they go.',
    tier: 'premium',
    marks: [
      { x: 35, y: 22, w: 30, h: 40, label: 'loose scribbled hand', side: 'above' },
      { x: 23, y: 81, w: 54, h: 13, label: 'fills organically as it moves', side: 'below' },
    ],
  },
  {
    id: 'nervous',
    label: 'Nervous',
    description: 'A quick, jittery line with visible hesitation.',
    tier: 'premium',
    marks: [
      { x: 34, y: 21, w: 32, h: 42, label: 'jittery line with hesitation', side: 'above' },
      { x: 44, y: 36, w: 13, h: 12, label: 'natural hand tremors', side: 'below' },
    ],
  },
  {
    id: 'topanchor',
    label: 'Top Anchor',
    description: 'Everything drops in from the top edge.',
    tier: 'premium',
    marks: [
      { x: 30, y: 15, w: 40, h: 25, label: 'drops in from top edge', side: 'above' },
      { x: 23, y: 81, w: 54, h: 13, label: 'flows downward to bottom', side: 'below' },
    ],
  },
  {
    id: 'gesture',
    label: 'Gesture',
    description: 'Broad, confident strokes with few lifts.',
    tier: 'premium',
    marks: [
      { x: 32, y: 18, w: 36, h: 46, label: 'broad confident sweeps', side: 'above' },
      { x: 23, y: 81, w: 54, h: 13, label: 'minimal hand lifts', side: 'below' },
    ],
  },
];

function StyleEasel({ style }: { style: AnimationStyleCard }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    const playPromise = v.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [style.id]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const replay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  return (
    <figure className="style-easel">
      <span className="shot-tape" aria-hidden="true" />
      <div
        className="style-easel-screen"
        onClick={togglePlay}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePlay();
          }
        }}
        aria-label={`${style.label} drawing demonstration. Click to pause or play.`}
      >
        <Image
          className="style-easel-poster"
          src={`/demos/styles/${style.id}.webp`}
          alt={`${style.label} style preview`}
          fill
          priority
          sizes="(max-width: 860px) 100vw, 760px"
        />
        <video
          ref={videoRef}
          key={style.id}
          className={`style-easel-video ${isPlaying ? 'is-playing' : ''}`}
          src={`/demos/styles/${style.id}.mp4`}
          muted
          loop
          autoPlay
          playsInline
          aria-hidden="true"
        />
        <div className="style-easel-overlay" aria-hidden="true">
          {style.marks.map((m) => (
            <span
              key={m.label}
              className="shot-mark"
              style={{
                left: `${m.x}%`,
                top: `${m.y}%`,
                width: `${m.w}%`,
                height: `${m.h}%`,
              }}
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d={ellipsePath(100, 100)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
              </svg>
              <span className={`shot-label sk-hand ${m.side === 'below' ? 'is-below' : ''}`}>
                {m.label}
              </span>
            </span>
          ))}
        </div>
      </div>
      <figcaption className="style-easel-meta">
        <div className="style-easel-info">
          <div className="style-easel-title-row">
            <h3 className="style-easel-title">{style.label}</h3>
            {style.tier === 'premium' ? (
              <span className="style-vignette-pro">pro</span>
            ) : (
              <span className="style-swatch-tag is-free">free</span>
            )}
          </div>
          <p className="style-easel-desc">{style.description}</p>
        </div>
        <div className="style-easel-actions">
          <button
            type="button"
            className="style-replay-btn"
            onClick={replay}
            aria-label={`Replay ${style.label} animation`}
          >
            <span aria-hidden="true">↺</span>
            <span>Replay drawing</span>
          </button>
        </div>
      </figcaption>
    </figure>
  );
}

function StylePalette({
  styles,
  activeId,
  onSelect,
  tier,
  onTierChange,
}: {
  styles: AnimationStyleCard[];
  activeId: string;
  onSelect: (id: string) => void;
  tier: 'all' | 'free' | 'premium';
  onTierChange: (tier: 'all' | 'free' | 'premium') => void;
}) {
  const combien = (t: 'free' | 'premium') =>
    styles.filter((s) => s.tier === t).length;

  const onglets: { cle: 'all' | 'free' | 'premium'; texte: string }[] = [
    { cle: 'all', texte: `All ${styles.length}` },
    { cle: 'free', texte: `Free ${combien('free')}` },
    { cle: 'premium', texte: `Premium ${combien('premium')}` },
  ];

  const visibles = tier === 'all'
    ? styles
    : styles.filter((s) => s.tier === tier);

  return (
    <div className="style-palette-container">
      <div className="style-palette-header">
        <span className="style-palette-label">Choose a hand style to test:</span>
        <div className="style-filtres">
          {onglets.map((o) => (
            <button
              key={o.cle}
              type="button"
              className={`style-filtre ${tier === o.cle ? 'is-on' : ''}`}
              onClick={() => onTierChange(o.cle)}
              aria-pressed={tier === o.cle}
            >
              {o.texte}
            </button>
          ))}
        </div>
      </div>

      <div className="style-palette-grid" role="tablist" aria-label="Animation styles palette">
        {visibles.map((style) => {
          const isActive = style.id === activeId;
          return (
            <button
              key={style.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`style-swatch-card ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelect(style.id)}
            >
              <span className="style-swatch-thumb">
                <Image
                  src={`/demos/styles/${style.id}.webp`}
                  alt=""
                  fill
                  sizes="60px"
                />
              </span>
              <span className="style-swatch-info">
                <span className="style-swatch-name">
                  <span className="style-swatch-title">{style.label}</span>
                  {style.tier === 'premium' ? (
                    <span className="style-swatch-tag">pro</span>
                  ) : (
                    <span className="style-swatch-tag is-free">free</span>
                  )}
                </span>
                <span className="style-swatch-desc">{style.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AnimationStyles() {
  const [tier, setTier] = useState<'all' | 'free' | 'premium'>('all');
  const [activeId, setActiveId] = useState<string>(ANIMATION_STYLES[0].id);

  const handleTierChange = (newTier: 'all' | 'free' | 'premium') => {
    setTier(newTier);
    if (newTier !== 'all') {
      const isCurrentInTier = ANIMATION_STYLES.some(
        (s) => s.id === activeId && s.tier === newTier,
      );
      if (!isCurrentInTier) {
        const firstInTier = ANIMATION_STYLES.find((s) => s.tier === newTier);
        if (firstInTier) {
          setActiveId(firstInTier.id);
        }
      }
    }
  };

  const activeStyle =
    ANIMATION_STYLES.find((s) => s.id === activeId) || ANIMATION_STYLES[0];

  return (
    <div className="style-showcase-layout">
      <div className="style-showcase-easel-col">
        <StyleEasel style={activeStyle} />
        <p className="sk-note animation-styles-note">
          every preview above is a real render, same engine as your projects ↑
        </p>
      </div>
      <div className="style-showcase-palette-col">
        <StylePalette
          styles={ANIMATION_STYLES}
          activeId={activeId}
          onSelect={setActiveId}
          tier={tier}
          onTierChange={handleTierChange}
        />
      </div>
    </div>
  );
}

export function AnimationStylesShowcase() {
  return (
    <div className="animation-styles-showcase">
      <div className="sec-head">
        <p className="sk-eyebrow">Hand animation styles</p>
        <h2>
          One script, <span className="sk-hl">twelve ways to draw it.</span>
        </h2>
        <p className="sec-lede">
          Pick a style per project, or per scene. Select any style below to watch the hand draw in real time.
        </p>
      </div>
      <AnimationStyles />
    </div>
  );
}
