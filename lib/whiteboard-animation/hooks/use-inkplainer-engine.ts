'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAnimationContext } from '../context/animation-context';
import type { InkplainerLayer } from '../engine/inkplainer-core';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { DEMO_ANNOTATIONS } from '../demo-annotations';
import type { Annotation } from '../schema';

// Import original SketchPilot animation library modules
const AnimationFactory = require('../lib/index');
const { CUSTOM_HANDS } = require('../lib/hands');
const { handDrawRect } = require('../lib/handLayout');

export interface UseInkplainerEngineProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  handCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  annotationCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  canvasWidth?: number;
  canvasHeight?: number;
  currentTime?: number;
  isPlaying?: boolean;
  duration?: number;
  onTogglePlay?: () => void;
}

export function useInkplainerEngine({
  canvasRef,
  handCanvasRef,
  annotationCanvasRef,
  canvasWidth = 1280,
  canvasHeight = 720,
  currentTime: externalCurrentTime,
  isPlaying: externalIsPlaying,
  duration: externalDuration,
  onTogglePlay,
}: UseInkplainerEngineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Get shared animation settings from context
  const {
    animStyle,
    setAnimStyle,
    handStyle,
    setHandStyle,
    revealSpeed,
    setRevealSpeed,
    handSpeed,
    setHandSpeed,
    chunks,
    setChunks,
    canvasBg,
    setCanvasBg,
    useAnnotation,
    setUseAnnotation,
  } = useAnimationContext();

  // Local states (not shared in context)
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('720p');
  const [projectName, setProjectName] = useState('Bold Diagram');

  // Get annotations from store
  const whiteboardConfig = useStoryboardStore((state) => state.whiteboardConfig);
  const setAnnotations = useStoryboardStore((state) => state.setAnnotations);
  const addAnnotation = useStoryboardStore((state) => state.addAnnotation);
  const updateAnnotation = useStoryboardStore((state) => state.updateAnnotation);
  const removeAnnotation = useStoryboardStore((state) => state.removeAnnotation);
  const annotations = whiteboardConfig.annotations;

  const animFrameRef = useRef<number | null>(null);
  const animInstanceRef = useRef<any>(null);
  const activeStyleRef = useRef<string>(animStyle);
  const handImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const annotationsRef = useRef<any[]>([]);

  // Active layers state
  const [layers, setLayers] = useState<InkplainerLayer[]>([
    {
      id: '1',
      name: 'scene-premium-bag',
      x: 0,
      y: 0,
      w: canvasWidth,
      h: canvasHeight,
      opacity: 1,
      visible: true,
      animStyle: 'chunkjump',
      handStyle: 'custom1',
      speed: 40,
      handSpeed: 6,
    },
  ]);

  // Sync animStyle changes to layer state
  const handleAnimStyleChange = useCallback((newStyle: string) => {
    setAnimStyle(newStyle);
    animInstanceRef.current = null;
    setProgress(0);
    setLayers((prev) =>
      prev.map((l) => (l.id === '1' ? { ...l, animStyle: newStyle } : l))
    );
  }, [setAnimStyle]);

  // Sync handStyle changes to layer state
  const handleHandStyleChange = useCallback((newHand: string) => {
    setHandStyle(newHand);
    setLayers((prev) =>
      prev.map((l) => (l.id === '1' ? { ...l, handStyle: newHand } : l))
    );
  }, [setHandStyle]);

  // Keep annotationsRef in sync with store
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  // Preload test image, annotations & real hand PNG images from /public/images/
  useEffect(() => {
    // 1. Load scene-premium-bag.png
    const img = new Image();
    img.src = '/scene-premium-bag.png';
    img.onload = () => {
      setLayers((prev) =>
        prev.map((l) => (l.id === '1' ? { ...l, imageElement: img } : l))
      );
    };

    // 2. Load annotations from store, fallback to demo data
    if (annotations.length === 0) {
      setAnnotations(DEMO_ANNOTATIONS);
    }

    // 3. Preload hand PNG assets
    const handKeys = [
      { key: 'custom1', src: '/images/hand1-720p.png' },
      { key: 'custom2', src: '/images/hand2-720p.png' },
      { key: 'custom3', src: '/images/hand3-720p.png' },
      { key: 'custom4', src: '/images/hand4-720p.png' },
      { key: 'hand1', src: '/images/hand1-720p.png' },
      { key: 'hand2', src: '/images/hand2-720p.png' },
      { key: 'hand3', src: '/images/hand3-720p.png' },
      { key: 'hand4', src: '/images/hand4-720p.png' },
    ];

    handKeys.forEach(({ key, src }) => {
      const hImg = new Image();
      hImg.src = src;
      hImg.onload = () => {
        handImagesRef.current[key] = hImg;
      };
    });
  }, []);

  // Redraw Main Canvas (Static / Full Image View)
  const drawMainCanvas = useCallback(
    (currentProgressPct = 100) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background Fill
      if (canvasBg === 'black') {
        ctx.fillStyle = '#111111';
      } else if (canvasBg === 'none') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      } else {
        ctx.fillStyle = canvasBg.startsWith('#') ? canvasBg : '#ffffff';
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw visible layers
      layers.forEach((layer) => {
        if (layer.visible && layer.imageElement && layer.imageElement.complete) {
          ctx.save();
          ctx.globalAlpha = layer.opacity;

          // Reveal clipping rect
          const revealW = (layer.w * currentProgressPct) / 100;
          ctx.beginPath();
          ctx.rect(layer.x, layer.y, revealW, layer.h);
          ctx.clip();

          ctx.drawImage(layer.imageElement, layer.x, layer.y, layer.w, layer.h);
          ctx.restore();
        }
      });
    },
    [canvasRef, canvasBg, layers]
  );

  // Render Real PNG Hand Overlay on Hand Canvas using handDrawRect
  const renderHandOverlay = useCallback(
    (tipX: number, tipY: number) => {
      const handCanvas = handCanvasRef.current;
      if (!handCanvas) return;
      const hctx = handCanvas.getContext('2d');
      if (!hctx) return;

      hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);

      if (handStyle === 'ghost') return;

      const normalizedKey =
        handStyle.toLowerCase().includes('hand1') || handStyle === 'hand1' ? 'custom1' :
        handStyle.toLowerCase().includes('hand2') || handStyle === 'hand2' ? 'custom2' :
        handStyle.toLowerCase().includes('hand3') || handStyle === 'hand3' ? 'custom3' :
        handStyle.toLowerCase().includes('hand4') || handStyle === 'hand4' ? 'custom4' : handStyle;

      const handConfig = CUSTOM_HANDS[normalizedKey] || CUSTOM_HANDS['custom1'];
      const imgConfig = handConfig?.images?.[720];
      const loadedHandImg = handImagesRef.current[normalizedKey] || handImagesRef.current['custom1'];

      if (imgConfig && loadedHandImg && loadedHandImg.complete) {
        // Calculate exact drawing rect using official handDrawRect function
        const rect = handDrawRect(
          imgConfig,
          720,
          tipX,
          tipY,
          canvasWidth,
          canvasHeight
        );

        // Draw real hand PNG sprite with tip positioned accurately on stroke
        hctx.drawImage(
          loadedHandImg,
          rect.x,
          rect.y,
          rect.width,
          rect.height
        );
      } else {
        // Fallback stylus rendering if PNG is still loading
        hctx.save();
        hctx.fillStyle = '#0f172a';
        hctx.beginPath();
        hctx.arc(tipX, tipY, 14, 0, Math.PI * 2);
        hctx.fill();

        hctx.strokeStyle = '#ffffff';
        hctx.lineWidth = 2.5;
        hctx.beginPath();
        hctx.moveTo(tipX - 15, tipY - 15);
        hctx.lineTo(tipX, tipY);
        hctx.stroke();
        hctx.restore();
      }
    },
    [handCanvasRef, handStyle, canvasWidth, canvasHeight]
  );

  // Draw Annotations Overlay
  const drawAnnotations = useCallback(
    (currentProgressPct: number = 0, elapsedMs: number = 0) => {
      const annCanvas = annotationCanvasRef?.current;
      if (!annCanvas) return;

      const actx = annCanvas.getContext('2d');
      if (!actx) return;

      actx.clearRect(0, 0, annCanvas.width, annCanvas.height);
      if (!useAnnotation || annotations.length === 0) return;

      const colorPalette = [
        { stroke: '#2563eb', fill: 'rgba(37, 99, 235, 0.12)' },   // Blue
        { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.12)' },   // Red
        { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.12)' },  // Green
        { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.12)' },  // Purple
        { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.12)' },  // Orange
        { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.12)' },   // Cyan
      ];

      annotations.forEach((annot, i) => {
        const region = annot.region;
        if (!region) return;

        const style = colorPalette[i % colorPalette.length];

        // 1. Semi-transparent fill
        actx.fillStyle = style.fill;
        actx.fillRect(region.x, region.y, region.width, region.height);

        // 2. Solid border stroke
        actx.strokeStyle = style.stroke;
        actx.lineWidth = 2;
        actx.strokeRect(region.x, region.y, region.width, region.height);

        // 3. Top-left number badge
        actx.fillStyle = style.stroke;
        actx.font = 'bold 13px Geist, sans-serif';
        actx.fillText(String(i + 1), region.x + 4, region.y + 14);
      });
    },
    [annotationCanvasRef, useAnnotation, annotations]
  );

  // Auto-render annotations overlay when idle or when settings change
  useEffect(() => {
    drawAnnotations(progress);
  }, [drawAnnotations, progress]);

  // Toggle Play / Pause Animation Loop
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      const handCanvas = handCanvasRef.current;
      if (handCanvas) {
        const hctx = handCanvas.getContext('2d');
        hctx?.clearRect(0, 0, handCanvas.width, handCanvas.height);
      }
      const annCanvas = annotationCanvasRef?.current;
      if (annCanvas) {
        const actx = annCanvas.getContext('2d');
        actx?.clearRect(0, 0, annCanvas.width, annCanvas.height);
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);

      const canvas = canvasRef.current;
      const handCanvas = handCanvasRef.current;
      if (!canvas || !handCanvas) return;

      const ctx = canvas.getContext('2d');
      const hctx = handCanvas.getContext('2d');
      if (!ctx || !hctx) return;

      let isStopped = false;

      // Check if we can resume existing animation instance
      const isResuming =
        animInstanceRef.current &&
        activeStyleRef.current === animStyle &&
        progress > 0 &&
        progress < 100;

      let anim = animInstanceRef.current;

      if (!isResuming) {
        // Fresh start: prepare offscreen canvas & reset main canvas
        const offscreen = document.createElement('canvas');
        offscreen.width = canvasWidth;
        offscreen.height = canvasHeight;
        const offCtx = offscreen.getContext('2d');

        const activeLayer = layers[0];
        if (activeLayer && activeLayer.imageElement) {
          offCtx?.drawImage(
            activeLayer.imageElement,
            activeLayer.x,
            activeLayer.y,
            activeLayer.w,
            activeLayer.h
          );
        }

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        if (canvasBg === 'black') {
          ctx.fillStyle = '#111111';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        } else if (canvasBg !== 'none') {
          ctx.fillStyle = canvasBg.startsWith('#') ? canvasBg : '#ffffff';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        const engineState = {
          canvasW: canvasWidth,
          canvasH: canvasHeight,
          speed: revealSpeed,
          handSpeed,
          hand: handStyle,
          tileSlider: chunks,
          contentBounds: {
            x: activeLayer?.x ?? 0,
            y: activeLayer?.y ?? 0,
            w: activeLayer?.w ?? canvasWidth,
            h: activeLayer?.h ?? canvasHeight,
          },
          annotations: useAnnotation ? annotationsRef.current : [],
        };

        try {
          anim = AnimationFactory.create(animStyle, {
            state: engineState,
            ctx,
            hctx,
            offscreen,
            callbacks: {
              fillBg: () => {
                if (canvasBg === 'black') {
                  ctx.fillStyle = '#111111';
                  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                } else if (canvasBg !== 'none') {
                  ctx.fillStyle = canvasBg.startsWith('#') ? canvasBg : '#ffffff';
                  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                }
              },
              drawHand: (...args: any[]) => {
                if (isStopped) return;
                let tipX = 0;
                let tipY = 0;
                if (typeof args[0] === 'number' && typeof args[1] === 'number') {
                  tipX = args[0];
                  tipY = args[1];
                } else if (typeof args[1] === 'number' && typeof args[2] === 'number') {
                  tipX = args[1];
                  tipY = args[2];
                }
                renderHandOverlay(tipX, tipY);
              },
              setProgress: (p: number) => {
                if (!isStopped) {
                  setProgress(Math.round(p * 100));
                }
              },
              finishAnim: () => {
                isStopped = true;
                animInstanceRef.current = null;
                if (animFrameRef.current) {
                  cancelAnimationFrame(animFrameRef.current);
                  animFrameRef.current = null;
                }
                setIsPlaying(false);
                setProgress(100);
                drawMainCanvas(100);
                hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
              },
              resScale: () => 1,
              resPointScale: () => 1,
            },
          });

          if (anim.setup) anim.setup();
          animInstanceRef.current = anim;
          activeStyleRef.current = animStyle;
        } catch (err) {
          console.error('Error starting AnimationFactory engine:', err);
          setIsPlaying(false);
          return;
        }
      }

      let lastTime = performance.now();

      const stepLoop = (now: number) => {
        if (isStopped) return;

        const deltaMs = Math.min(100, now - lastTime);
        lastTime = now;

        if (anim && anim.tick) {
          anim.tick(revealSpeed, deltaMs);
        }

        drawAnnotations(progress, now);

        if (!isStopped) {
          animFrameRef.current = requestAnimationFrame(stepLoop);
        }
      };

      animFrameRef.current = requestAnimationFrame(stepLoop);
    }
  }, [
    isPlaying,
    progress,
    revealSpeed,
    handSpeed,
    handStyle,
    chunks,
    animStyle,
    canvasRef,
    handCanvasRef,
    canvasWidth,
    canvasHeight,
    canvasBg,
    layers,
    drawMainCanvas,
    renderHandOverlay,
    drawAnnotations,
  ]);

  // Reset Animation
  const resetAnimation = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    animInstanceRef.current = null;
    setIsPlaying(false);
    setProgress(0);

    const handCanvas = handCanvasRef.current;
    if (handCanvas) {
      const hctx = handCanvas.getContext('2d');
      hctx?.clearRect(0, 0, handCanvas.width, handCanvas.height);
    }

    const annCanvas = annotationCanvasRef?.current;
    if (annCanvas) {
      const actx = annCanvas.getContext('2d');
      actx?.clearRect(0, 0, annCanvas.width, annCanvas.height);
    }

    drawMainCanvas(0);
  }, [drawMainCanvas, handCanvasRef, annotationCanvasRef]);

  useEffect(() => {
    if (!isPlaying && progress === 0) {
      drawMainCanvas(100);
    }
  }, [drawMainCanvas, isPlaying, progress]);

  // Sync playback state with external timeline playback
  useEffect(() => {
    if (externalIsPlaying !== undefined && externalIsPlaying !== isPlaying) {
      togglePlay();
    }
  }, [externalIsPlaying, isPlaying, togglePlay]);

  // Sync external currentTime during timeline seeking when paused
  useEffect(() => {
    if (!isPlaying && externalCurrentTime !== undefined && externalDuration && externalDuration > 0) {
      const calculatedPct = Math.min(100, Math.max(0, Math.round((externalCurrentTime / externalDuration) * 100)));
      setProgress(calculatedPct);
    }
  }, [externalCurrentTime, externalDuration, isPlaying]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const updateAnnotationRegion = useCallback(
    (index: number, newRegion: { x: number; y: number; width: number; height: number }) => {
      const annot = annotations[index];
      if (annot) {
        updateAnnotation(annot.id, { region: newRegion });
        annotationsRef.current = annotations;
      }
    },
    [annotations, updateAnnotation]
  );

  const addAnnotationRegion = useCallback(() => {
    const newAnnot: Annotation = {
      id: `annot-${Date.now()}`,
      text: `Region ${annotations.length + 1}`,
      region: {
        x: 100 + ((annotations.length * 30) % 400),
        y: 100 + ((annotations.length * 30) % 300),
        width: 250,
        height: 180,
      },
      reveal: {
        from: annotations.length * 2000,
        to: (annotations.length + 1) * 2000,
        durationMs: 2000,
      },
      style: {
        strokeColor: '#000000',
        strokeWidth: 2,
        opacity: 1,
      },
    };
    addAnnotation(newAnnot);
    setSelectedIndex(annotations.length);
  }, [annotations, addAnnotation]);

  const deleteAnnotationRegion = useCallback((index: number) => {
    const annot = annotations[index];
    if (annot) {
      removeAnnotation(annot.id);
      setSelectedIndex(null);
    }
  }, [annotations, removeAnnotation]);

  return {
    isPlaying,
    progress,
    togglePlay,
    resetAnimation,
    annotations,
    selectedIndex,
    setSelectedIndex,
    updateAnnotationRegion,
    addAnnotationRegion,
    deleteAnnotationRegion,
    animStyle,
    setAnimStyle: handleAnimStyleChange,
    handStyle,
    setHandStyle: handleHandStyleChange,
    revealSpeed,
    setRevealSpeed,
    handSpeed,
    setHandSpeed,
    chunks,
    setChunks,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    canvasBg,
    setCanvasBg,
    projectName,
    setProjectName,
    layers,
    setLayers,
    useAnnotation,
    setUseAnnotation,
  };
}
