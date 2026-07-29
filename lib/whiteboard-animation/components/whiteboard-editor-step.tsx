'use client';

import { useRef, useEffect } from 'react';
import { WhiteboardConfigPanel } from './whiteboard-config-panel';
import { AudioPanel } from './audio-panel';
import { TranscriptPanel } from './transcript-panel';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import { useWhiteboardRenderer } from '../hooks/use-whiteboard-renderer';
import { AnnotationTimeline } from '../timeline/annotation-timeline';
import type { WhiteboardConfig } from '@/lib/storyboard/store';
import { tailleCanvas, cssAspectRatio, type RatioProjet } from '../canvas-size';

interface WhiteboardEditorStepProps {
  config: WhiteboardConfig;
  /** Ratio du PROJET (projectParams), seule source pour la forme du canvas. */
  aspectRatio: RatioProjet;
  onConfigChange: (config: Partial<WhiteboardConfig>) => void;
  onNavigateBack?: () => void;
  onNavigateNext?: () => void;
}

export function WhiteboardEditorStep({
  config,
  aspectRatio,
  onConfigChange,
  onNavigateBack,
  onNavigateNext,
}: WhiteboardEditorStepProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);

  const { width: canvasWidth, height: canvasHeight } = tailleCanvas(aspectRatio);

  // Connect to unified engine
  const {
    progress,
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
    annotations,
    setCurrentTime,
  } = useUnifiedEngine();

  // Enable canvas rendering
  useWhiteboardRenderer({
    canvasRef,
    canvasWidth,
    canvasHeight,
    handCanvasRef,
    annotationCanvasRef,
    // Muted still plays (silently) to keep serving as the clock — only the
    // absence of a track falls back to wall-clock timing.
    audioUrl: config.audio?.url ?? null,
    audioVolume: config.audio?.volume ?? 1,
    audioMuted: config.audio?.muted ?? false,
  });

  // Sync config with engine (Zustand setters are stable, safe to use without listing as deps)
  useEffect(() => {
    setAnimStyle(config.animStyle);
    setHandStyle(config.handStyle);
    setRevealSpeed(config.revealSpeed);
    setHandSpeed(config.handSpeed);
    setChunks(config.chunks);
    setCanvasBg(config.canvasBg);
  }, [config]); // Only config, not the setters which are stable from Zustand

  // Reset animation when needed
  const resetAnimation = () => {
    setCurrentTime(0);
  };

  return (
    <div className="w-full h-full flex gap-6 overflow-hidden">
      {/* Left: Canvas Preview */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-4 justify-start">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Whiteboard Preview</h2>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{config.animStyle}</span>
            <span>{config.handStyle}</span>
            <span>{aspectRatio}</span>
            <span>{Math.round(progress)}%</span>
            {annotations.length > 0 && (
              <span>{annotations.length} annotations</span>
            )}
          </div>
        </div>

        {/* Canvas Container — suit le ratio du projet et reste plafonne en
            hauteur pour que le timeline et la lecture restent au-dessus de la
            ligne de flottaison. */}
        <div
          className="shrink-0 mx-auto w-full rounded-lg border border-white/10 bg-black overflow-hidden relative"
          style={{
            aspectRatio: cssAspectRatio(aspectRatio),
            maxWidth: `min(100%, calc(52vh * ${canvasWidth} / ${canvasHeight}))`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full object-contain"
          />
          <canvas
            ref={handCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
          {/* Calque de reperage des annotations. Il masque le dessin qu'on est
              venu regarder : il s'efface donc pendant la lecture et revient a
              l'arret, fin de lecture comprise. L'opacite est pilotee par
              use-whiteboard-renderer, qui sait aussi quand on scrube. */}
          <canvas
            ref={annotationCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-300"
          />
        </div>

        <AnnotationTimeline />

        {/* Play/pause lives in the timeline toolbar; only reset is extra. */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetAnimation}
            className="flex gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Right: Config Panel */}
      <div className="w-96 flex flex-col gap-4 overflow-y-auto pb-6">
        <WhiteboardConfigPanel
          config={config}
          onChange={(updates) => {
            // Update store for persistence
            onConfigChange(updates);
            // Sync each field with engine
            if (updates.animStyle) setAnimStyle(updates.animStyle);
            if (updates.handStyle) setHandStyle(updates.handStyle);
            if (updates.revealSpeed !== undefined) setRevealSpeed(updates.revealSpeed);
            if (updates.handSpeed !== undefined) setHandSpeed(updates.handSpeed);
            if (updates.chunks !== undefined) setChunks(updates.chunks);
            if (updates.canvasBg) setCanvasBg(updates.canvasBg);
          }}
        />

        <AudioPanel />
        <TranscriptPanel />

        {/* Navigation Buttons */}
        <div className="flex gap-2 sticky bottom-0 bg-background pt-4 border-t">
          <Button
            variant="outline"
            onClick={onNavigateBack}
            className="flex-1"
          >
            ← Back
          </Button>
          <Button
            onClick={onNavigateNext}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
