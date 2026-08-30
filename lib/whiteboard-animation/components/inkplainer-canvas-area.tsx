'use client';

import React from 'react';
import { RotateCcw, Play, Pause, Crop, PenTool } from 'lucide-react';
import { AnnotationTimeline } from '../timeline/annotation-timeline';

interface InkplainerCanvasAreaProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  handCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  annotationCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  animStyleLabel: string;
  isPlaying: boolean;
  progress: number;
  useAnnotation?: boolean;
  onTogglePlay: () => void;
  onResetAnimation: () => void;
  onOpenSlicer?: () => void;
  onOpenAnnotate?: () => void;
}

export const InkplainerCanvasArea: React.FC<InkplainerCanvasAreaProps> = ({
  canvasRef,
  handCanvasRef,
  annotationCanvasRef,
  canvasWidth,
  canvasHeight,
  animStyleLabel,
  isPlaying,
  progress,
  useAnnotation = false,
  onTogglePlay,
  onResetAnimation,
  onOpenSlicer,
  onOpenAnnotate,
}) => {
  return (
    <main className="flex-1 flex flex-col bg-muted/20 h-full overflow-hidden relative">
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-card/90 backdrop-blur border border-border rounded-full px-4 py-1.5 shadow-lg flex items-center gap-3">
        <button
          onClick={onTogglePlay}
          className="p-1.5 hover:bg-muted rounded-full transition-colors text-foreground"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={onResetAnimation}
          className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
          title="Reset"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-border" />
        {onOpenSlicer && (
          <button
            onClick={onOpenSlicer}
            className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
          >
            <Crop className="w-4 h-4" />
            <span>Slicer</span>
          </button>
        )}
        {onOpenAnnotate && (
          <button
            onClick={onOpenAnnotate}
            className={`p-1.5 rounded-full transition-colors flex items-center gap-1 text-xs ${
              useAnnotation ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Annotate</span>
          </button>
        )}
      </div>

      {/* Canvas Viewport */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <div
          className="relative bg-black rounded-lg shadow-2xl overflow-hidden"
          style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, maxWidth: '100%', maxHeight: '100%', aspectRatio: '16/9' }}
        >
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full object-contain absolute inset-0"
          />
          <canvas
            ref={handCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full object-contain absolute inset-0 pointer-events-none"
          />
          <canvas
            ref={annotationCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full object-contain absolute inset-0 pointer-events-none"
          />
        </div>
      </div>

      <AnnotationTimeline />
    </main>
  );
};