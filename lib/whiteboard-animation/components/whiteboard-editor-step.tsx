'use client';

import { useRef, useState } from 'react';
import { WhiteboardCanvas } from './whiteboard-canvas';
import { WhiteboardConfigPanel } from './whiteboard-config-panel';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';
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

  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="w-full h-full flex gap-6">
      {/* Left: Canvas Preview */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Whiteboard Preview</h2>
          <p className="text-sm text-muted-foreground">
            {config.animStyle} • {config.handStyle} • {config.resolution}
          </p>
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

        {/* Playback Controls */}
        <div className="flex gap-2">
          <Button
            variant={isPlaying ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex gap-2"
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
            onClick={() => setIsPlaying(false)}
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
          onChange={onConfigChange}
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
