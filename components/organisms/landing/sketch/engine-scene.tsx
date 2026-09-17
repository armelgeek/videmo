"use client";

import { useEffect, useRef } from "react";
import {
  SCENE_PREMIUM_BAG_ANNOTATIONS,
  projectAnnotations,
} from "@/lib/whiteboard-animation/data/scene-premium-bag";
import { rectContenu } from "@/lib/whiteboard-animation/canvas-size";

// The engine library is CommonJS shared with the server renderer.
/* eslint-disable @typescript-eslint/no-require-imports */
const AnimationFactory = require("@/lib/whiteboard-animation/lib/index");
const { CUSTOM_HANDS } = require("@/lib/whiteboard-animation/lib/hands");
const { handDrawRect } = require("@/lib/whiteboard-animation/lib/handLayout");
const { blanchirFond } = require("@/lib/whiteboard-animation/lib/fond-blanc");
/* eslint-enable @typescript-eslint/no-require-imports */

const W = 1280;
const H = 720;
const ENGINE_SPEED = 40;
const HOLD_MS = 2600;
const SCENE_IMAGE = "/scene-premium-bag.png";
const HAND_IMAGE = "/images/hand1-720p.png";

const SCHEDULE = SCENE_PREMIUM_BAG_ANNOTATIONS.map((a) => ({
  from: a.reveal.startMs ?? 0,
  to: (a.reveal.startMs ?? 0) + (a.reveal.durationMs ?? 0),
}));
const TOTAL_MS = Math.max(...SCHEDULE.map((s) => s.to));

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export function EngineScene({
  aspectRatio = "16:9",
}: {
  aspectRatio?: "16:9" | "9:16" | "1:1";
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const handCanvas = handRef.current;
    const ctx = canvas?.getContext("2d");
    const hctx = handCanvas?.getContext("2d");
    if (!canvas || !handCanvas || !ctx || !hctx) return;

    let raf = 0;
    let cancelled = false;

    const run = async () => {
      const [scene, hand] = await Promise.all([loadImage(SCENE_IMAGE), loadImage(HAND_IMAGE)]);
      if (cancelled) return;

      const artwork = rectContenu(W, H, scene.naturalWidth, scene.naturalHeight);
      const offscreen = document.createElement("canvas");
      offscreen.width = W;
      offscreen.height = H;
      const octx = offscreen.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      octx.drawImage(scene, artwork.x, artwork.y, artwork.w, artwork.h);
      blanchirFond(octx, W, H);
      (offscreen as HTMLCanvasElement & { __immutable?: boolean }).__immutable = true;

      const paintWhite = (target: CanvasRenderingContext2D) => {
        target.fillStyle = "#ffffff";
        target.fillRect(0, 0, W, H);
      };

      const showFinal = () => {
        paintWhite(ctx);
        ctx.drawImage(offscreen, 0, 0);
        hctx.clearRect(0, 0, W, H);
      };

      showFinal();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const handConfig = CUSTOM_HANDS.custom1.images[720];
      const annotations = projectAnnotations(SCENE_PREMIUM_BAG_ANNOTATIONS, artwork.w, artwork.h).map(
        (a) => ({
          ...a,
          region: { ...a.region, x: a.region.x + artwork.x, y: a.region.y + artwork.y },
        }),
      );

      const buildEngine = () => {
        paintWhite(ctx);
        return AnimationFactory.create("chunkjump", {
          state: {
            canvasW: W,
            canvasH: H,
            speed: ENGINE_SPEED,
            handSpeed: 5,
            hand: "custom1",
            animStyle: "chunkjump",
            contentBounds: artwork,
            annotations,
          },
          ctx,
          hctx,
          offscreen,
          callbacks: {
            fillBg: () => paintWhite(ctx),
            drawHand: (...args: unknown[]) => {
              const [a, b, c] = args;
              const tipX = typeof a === "number" ? a : (b as number);
              const tipY = typeof a === "number" ? (b as number) : (c as number);
              if (typeof tipX !== "number" || typeof tipY !== "number") return;
              hctx.clearRect(0, 0, W, H);
              const r = handDrawRect(handConfig, 720, tipX, tipY, W, H);
              hctx.drawImage(hand, r.x, r.y, r.width, r.height);
            },
            setProgress: () => {},
            finishAnim: () => hctx.clearRect(0, 0, W, H),
            resScale: () => 1,
            resPointScale: () => 1,
          },
        });
      };

      let anim = buildEngine();
      let elapsed = 0;
      let last = performance.now();

      const frame = (now: number) => {
        if (cancelled) return;
        const delta = Math.min(now - last, 1000);
        last = now;
        elapsed += delta;

        if (elapsed <= TOTAL_MS) {
          anim.tick(ENGINE_SPEED, delta);
        } else if (elapsed <= TOTAL_MS + delta) {
          showFinal();
        } else if (elapsed > TOTAL_MS + HOLD_MS) {
          elapsed = 0;
          anim = buildEngine();
        }
        raf = requestAnimationFrame(frame);
      };

      window.setTimeout(() => {
        if (cancelled) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }, 900);
    };

    run().catch((err) => console.error("[EngineScene]", err));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <figure className="sk-box sk-box-lift hero-engine-figure" style={{ margin: 0, overflow: "hidden" }}>
      <div
        className={`hero-canvas-viewport is-${aspectRatio.replace(":", "-")}`}
        style={{ position: "relative", background: "#ffffff" }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          aria-label="Scene drawn live by hand by the animation engine"
          className="hero-engine-canvas"
        />
        <canvas
          ref={handRef}
          width={W}
          height={H}
          aria-hidden="true"
          className="hero-engine-hand"
        />
      </div>
    </figure>
  );
}
