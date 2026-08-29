'use client';

import { useEffect, useRef } from 'react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';

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
  const { progress, canvasBg, useAnnotation, annotations } = useUnifiedEngine();
  const animFrameRef = useRef<number | null>(null);

  // Draw main canvas (static/preview)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    if (canvasBg === 'black') {
      ctx.fillStyle = '#111111';
    } else if (canvasBg !== 'none') {
      ctx.fillStyle = canvasBg.startsWith('#') ? canvasBg : '#ffffff';
    } else {
      return;
    }

    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw progress indicator
    const progressBarHeight = 2;
    const progressWidth = (progress / 100) * canvas.width;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, progressWidth, progressBarHeight);
  }, [progress, canvasBg, canvasRef]);

  // Draw annotations overlay
  useEffect(() => {
    const annCanvas = annotationCanvasRef?.current;
    if (!annCanvas) return;

    const actx = annCanvas.getContext('2d');
    if (!actx) return;

    actx.clearRect(0, 0, annCanvas.width, annCanvas.height);
    if (!useAnnotation || annotations.length === 0) return;

    const colorPalette = [
      { stroke: '#2563eb', fill: 'rgba(37, 99, 235, 0.12)' },
      { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.12)' },
      { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.12)' },
      { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.12)' },
      { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.12)' },
      { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.12)' },
    ];

    annotations.forEach((annot, i) => {
      const region = annot.region;
      if (!region) return;

      const style = colorPalette[i % colorPalette.length];

      actx.fillStyle = style.fill;
      actx.fillRect(region.x, region.y, region.width, region.height);

      actx.strokeStyle = style.stroke;
      actx.lineWidth = 2;
      actx.strokeRect(region.x, region.y, region.width, region.height);

      actx.fillStyle = style.stroke;
      actx.font = 'bold 13px Geist, sans-serif';
      actx.fillText(String(i + 1), region.x + 4, region.y + 14);
    });
  }, [useAnnotation, annotations, annotationCanvasRef]);

  // Clear hand canvas (for now - hand animation would go here)
  useEffect(() => {
    const handCanvas = handCanvasRef.current;
    if (!handCanvas) return;

    const hctx = handCanvas.getContext('2d');
    if (!hctx) return;

    hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  }, [handCanvasRef]);
}
