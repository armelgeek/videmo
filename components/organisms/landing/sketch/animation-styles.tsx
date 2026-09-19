"use client";

import { useEffect, useRef, useState } from "react";
import { HandArrow } from "./hand-arrow";

/**
 * Les styles tels que le moteur les connait : `id` est la valeur passee a
 * AnimationFactory, pas une etiquette marketing. Une carte qui annonce un style
 * introuvable enverrait l'utilisateur vers un rendu en chunkjump sans le dire.
 */
export interface AnimationStyleCard {
  id: string;
  label: string;
  description: string;
  tier: "free" | "premium";
}

export const ANIMATION_STYLES: AnimationStyleCard[] = [
  {
    id: "chunkjump",
    label: "Chunk Jump",
    description: "Block by block, the hand jumping to each new one.",
    tier: "free",
  },
  {
    id: "contour",
    label: "Contour",
    description: "Every outline traced first, shapes settle in after.",
    tier: "free",
  },
  {
    id: "scanner",
    label: "Scanner",
    description: "A band sweeps across and leaves the artwork behind it.",
    tier: "free",
  },
  {
    id: "outlineonly",
    label: "Outline Only",
    description: "Line work alone, no colour fill.",
    tier: "free",
  },
  {
    id: "illustfill",
    label: "Illustration",
    description: "Outline by hand, then every colour laid in.",
    tier: "premium",
  },
  {
    id: "outlinefill",
    label: "Outline Fill",
    description: "Outline first, then colour sweeps in from the top.",
    tier: "premium",
  },
  {
    id: "brushfill",
    label: "Brush Fill",
    description:
      "Hatched strokes on small areas, one angled sweep on large ones.",
    tier: "premium",
  },
  {
    id: "outlinechunks",
    label: "Outline Chunks",
    description: "Outlines arrive in pieces, never one continuous line.",
    tier: "premium",
  },
  {
    id: "scribble",
    label: "Scribble",
    description: "Loose scribbled strokes that fill as they go.",
    tier: "premium",
  },
  {
    id: "nervous",
    label: "Nervous",
    description: "A quick, jittery line with visible hesitation.",
    tier: "premium",
  },
  {
    id: "topanchor",
    label: "Top Anchor",
    description: "Column by column, each one pulled down from the top.",
    tier: "premium",
  },
  {
    id: "gesture",
    label: "Gesture",
    description: "Broad, confident strokes with few lifts.",
    tier: "premium",
  },
  {
    id: "skeletontrace",
    label: "Skeleton Trace",
    description: "Line art drawn along topological skeleton paths with adaptive pen width.",
    tier: "premium",
  },
];

const AUTO_ADVANCE_MS = 6000;

export function AnimationStylesShowcase() {
  const [activeId, setActiveId] = useState(ANIMATION_STYLES[0].id);
  const [autoplay, setAutoplay] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeIndex = Math.max(
    0,
    ANIMATION_STYLES.findIndex((s) => s.id === activeId),
  );
  const active = ANIMATION_STYLES[activeIndex];

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, [activeId]);

  useEffect(() => {
    if (
      !autoplay ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const t = window.setTimeout(() => {
      const i = ANIMATION_STYLES.findIndex((s) => s.id === activeId);
      setActiveId(ANIMATION_STYLES[(i + 1) % ANIMATION_STYLES.length].id);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(t);
  }, [autoplay, activeId]);

  const choose = (id: string) => {
    setAutoplay(false);
    setActiveId(id);
  };

  const onTabKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = ANIMATION_STYLES.findIndex((s) => s.id === activeId);
    const next =
      ANIMATION_STYLES[
        (i + step + ANIMATION_STYLES.length) % ANIMATION_STYLES.length
      ];
    choose(next.id);
    document.getElementById(`style-tab-${next.id}`)?.focus();
  };

  return (
    <div className="style-stage">
      <div className="style-stage-side">
        <p className="sk-eyebrow">Hand animation styles</p>
        <h2 className="style-stage-title">
          One script, <span className="sk-hl">thirteen ways to draw it.</span>
        </h2>
        <p className="sec-lede">
          Pick a style per project, or per scene. Every preview is a real
          render.
        </p>
        <div
          className="style-tabs"
          role="tablist"
          aria-label="Hand animation styles"
          onKeyDown={onTabKey}
        >
          {ANIMATION_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`style-tab-${s.id}`}
              aria-selected={s.id === activeId}
              aria-controls="style-stage-panel"
              tabIndex={s.id === activeId ? 0 : -1}
              className={`style-tab ${s.id === activeId ? "is-on" : ""}`}
              onClick={() => choose(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="sk-note style-stage-hint" aria-hidden="true">
          pick one, watch the hand draw it
          <HandArrow variant="right" className="style-stage-arrow" />
        </p>
      </div>

      <div className="style-sheet-wrap">
        <figure
          className="style-sheet"
          id="style-stage-panel"
          role="tabpanel"
          aria-labelledby={`style-tab-${active.id}`}
        >
          <span className="shot-tape" aria-hidden="true" />
          <span className="style-sheet-count sk-hand" aria-hidden="true">
            {String(activeIndex + 1).padStart(2, "0")} /{" "}
            {ANIMATION_STYLES.length}
          </span>
          <video
            ref={videoRef}
            key={active.id}
            className="style-sheet-video"
            src={`/demos/styles/${active.id}.mp4`}
            poster={`/demos/styles/${active.id}.webp`}
            muted
            loop
            autoPlay
            playsInline
            aria-label={`${active.label} drawing style, real render`}
          />
          {autoplay && (
            <span
              key={`progress-${active.id}`}
              className="style-sheet-progress"
              style={{ animationDuration: `${AUTO_ADVANCE_MS}ms` }}
              aria-hidden="true"
            />
          )}
          <figcaption className="style-caption">
            <span className="sk-hand">{active.description}</span>
            <span
              className={`style-caption-tier ${active.tier === "free" ? "is-free" : ""}`}
            >
              {active.tier === "free" ? "free" : "pro"}
            </span>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
