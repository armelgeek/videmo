'use client';

import { useRef, useEffect } from 'react';
import { WhiteboardConfigPanel } from './whiteboard-config-panel';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import { useWhiteboardRenderer } from '../hooks/use-whiteboard-renderer';
import type { WhiteboardConfig } from '@/lib/storyboard/store';

interface WhiteboardEditorStepProps {
  config: WhiteboardConfig;
  onConfigChange: (config: Partial<WhiteboardConfig>) => void;
  onNavigateBack?: () => void;
  onNavigateNext?: () => void;
}

export function WhiteboardEditorStep({
  config,
  onConfigChange,
  onNavigateBack,
  onNavigateNext,
}: WhiteboardEditorStepProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);

  const canvasWidth = config.resolution === '720p' ? 1280 : 1920;
  const canvasHeight = config.resolution === '720p' ? 720 : 1080;

  // Connect to unified engine
  const {
    isPlaying,
    progress,
    togglePlay,
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
    annotations,
    setCurrentTime,
  } = useUnifiedEngine();

  // Enable canvas rendering
  useWhiteboardRenderer({
    canvasRef,
    handCanvasRef,
    annotationCanvasRef,
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
    <div className="w-full h-full flex gap-6">
      {/* Left: Canvas Preview */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Whiteboard Preview</h2>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{config.animStyle}</span>
            <span>{config.handStyle}</span>
            <span>{config.resolution}</span>
            <span>{progress}%</span>
            {annotations.length > 0 && (
              <span>{annotations.length} annotations</span>
            )}
          </div>
        </div>

        {/* Canvas Container */}
        <div className="flex-1 rounded-lg border border-white/10 bg-black overflow-hidden relative">
          <canvas
            ref={canvasRef}
            width={config.resolution === '720p' ? 1280 : 1920}
            height={config.resolution === '720p' ? 720 : 1080}
            className="w-full h-full object-contain"
          />
          <canvas
            ref={handCanvasRef}
            width={config.resolution === '720p' ? 1280 : 1920}
            height={config.resolution === '720p' ? 720 : 1080}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
          <canvas
            ref={annotationCanvasRef}
            width={config.resolution === '720p' ? 1280 : 1920}
            height={config.resolution === '720p' ? 720 : 1080}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        </div>

        {/* Progress Bar */}
        <div className="bg-muted rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Playback Controls */}
        <div className="flex gap-2">
          <Button
            variant={isPlaying ? 'default' : 'outline'}
            size="sm"
            onClick={togglePlay}
            className="flex gap-2 flex-1"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Play
              </>
            )}
          </Button>
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
