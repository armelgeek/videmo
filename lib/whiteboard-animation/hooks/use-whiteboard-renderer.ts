'use client';

import { useEffect, useRef, useState } from 'react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import {
  SCENE_PREMIUM_BAG_ANNOTATIONS,
  SCENE_PREMIUM_BAG_DURATION_MS,
  projectAnnotations,
} from '../data/scene-premium-bag';

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
  const { progress, isPlaying, currentTime, canvasBg, useAnnotation, annotations } =
    useUnifiedEngine();

  // Idle at 0% shows the finished image, not an empty canvas
  const displayProgress = !isPlaying && progress === 0 ? 100 : progress;
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Seed the demo scene once: annotations projected onto the canvas, plus its duration.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    seededRef.current = true;

    const store = useUnifiedEngineStore.getState();
    if (store.animation.annotations.length === 0) {
      const projected = projectAnnotations(
        SCENE_PREMIUM_BAG_ANNOTATIONS,
        canvas.width,
        canvas.height
      );
      projected.forEach((a) => store.addAnnotation(a));
    }
    if (store.timeline.duration === 0) {
      store.setDuration(SCENE_PREMIUM_BAG_DURATION_MS);
    }
  }, [canvasRef]);

  // Load background image
  useEffect(() => {
    const img = new Image();
    img.src = '/scene-premium-bag.png';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load image:', img.src);
      setImageLoaded(false);
    };
  }, []);

  // Playback clock: advance currentTime while playing, stop at the end.
  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let last = performance.now();

    const step = (now: number) => {
      const delta = now - last;
      last = now;

      const store = useUnifiedEngineStore.getState();
      const next = store.timeline.currentTime + delta;

      if (next >= store.timeline.duration) {
        store.setCurrentTime(store.timeline.duration);
        store.setIsPlaying(false);
        return;
      }

      store.setCurrentTime(next);
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  // Draw main canvas with image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background first
    if (canvasBg === 'black') {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (canvasBg !== 'none') {
      ctx.fillStyle = canvasBg.startsWith('#') ? canvasBg : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw image if loaded
    if (imageLoaded && imageRef.current) {
      try {
        const pct = Math.max(0, Math.min(1, displayProgress / 100));
        const revealWidth = pct * canvas.width;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, revealWidth, canvas.height);
        ctx.clip();

        ctx.drawImage(
          imageRef.current,
          0,
          0,
          canvas.width,
          canvas.height
        );

        ctx.restore();
      } catch (e) {
        console.error('Error drawing image:', e);
      }
    }

    // Draw progress bar
    const progressBarHeight = 3;
    const progressWidth = (progress / 100) * canvas.width;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, progressWidth, progressBarHeight);
  }, [progress, displayProgress, canvasBg, canvasRef, imageLoaded]);

  // Draw annotations overlay
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

      // Numbered badge with the element label beside it
      const label = `${i + 1}. ${annot.text}`;
      actx.font = 'bold 14px Geist, sans-serif';
      const textWidth = actx.measureText(label).width;

      actx.fillStyle = stroke;
      actx.fillRect(region.x, Math.max(0, region.y - 22), textWidth + 12, 22);

      actx.fillStyle = '#ffffff';
      actx.fillText(label, region.x + 6, Math.max(0, region.y - 22) + 16);
    });
  }, [useAnnotation, annotations, annotationCanvasRef, currentTime, isPlaying]);

  // Clear hand canvas
  useEffect(() => {
    const handCanvas = handCanvasRef.current;
    if (!handCanvas) return;

    const hctx = handCanvas.getContext('2d');
    if (!hctx) return;

    hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  }, [handCanvasRef]);
}
