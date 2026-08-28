'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAnimationEngine } from '../hooks/use-animation-engine';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  ZoomIn,
  ZoomOut,
  Trash2,
} from 'lucide-react';

interface WhiteboardCanvasProps {
  canvasWidth?: number;
  canvasHeight?: number;
  onExport?: (canvas: HTMLCanvasElement) => void;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  canvasWidth = 1280,
  canvasHeight = 720,
  onExport,
}) => {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [speed, setSpeed] = useState(40);
  const [progress, setProgress] = useState(0);
  const animationRef = useRef<number | null>(null);

  // Initialize animation engine
  const engineState = {
    canvasW: canvasWidth,
    canvasH: canvasHeight,
    speed,
    playing: isPlaying,
    _animProgress: progress,
    contentBounds: {
      x: 0,
      y: 0,
      w: canvasWidth,
      h: canvasHeight,
    },
  };

  const engine = useAnimationEngine(
    mainCanvasRef.current,
    handCanvasRef.current,
    selectCanvasRef.current,
    engineState,
    {
      onFrame: (prog) => setProgress(prog),
      onError: (error) => console.error('Animation error:', error),
    }
  );

  // Setup canvases
  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    const handCanvas = handCanvasRef.current;
    const selectCanvas = selectCanvasRef.current;

    if (!mainCanvas || !handCanvas || !selectCanvas) return;

    // Set canvas sizes
    mainCanvas.width = canvasWidth;
    mainCanvas.height = canvasHeight;
    handCanvas.width = canvasWidth;
    handCanvas.height = canvasHeight;
    selectCanvas.width = canvasWidth;
    selectCanvas.height = canvasHeight;
  }, [canvasWidth, canvasHeight]);

  // Animation loop
  useEffect(() => {
    if (!engine.isReady) return;

    let lastTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const deltaMs = now - lastTime;
      lastTime = now;

      if (isPlaying) {
        engine.tick(deltaMs);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [engine, isPlaying]);

  const handlePlayPause = () => {
    if (isPlaying) {
      engine.pause();
    } else {
      engine.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleClear = () => {
    engine.stop();
    setProgress(0);
    const canvas = mainCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
    }
  };

  const handleReset = () => {
    engine.stop();
    setIsPlaying(false);
    setProgress(0);
    handleClear();
  };

  const handleZoom = (direction: 'in' | 'out') => {
    setZoom((z) => (direction === 'in' ? Math.min(z + 0.2, 3) : Math.max(z - 0.2, 0.5)));
  };

  const handleExport = () => {
    const canvas = mainCanvasRef.current;
    if (canvas && onExport) {
      onExport(canvas);
    } else if (canvas) {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `whiteboard-${Date.now()}.png`;
      link.click();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-muted/50 border-b border-border px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">Speed:</div>
          <input
            type="range"
            min="1"
            max="100"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-24 h-2"
          />
          <span className="text-xs text-muted-foreground w-8 text-right">{Math.round((speed / 40) * 100)}%</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleZoom('out')}
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleZoom('in')}
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            title="Export as PNG"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            title="Clear canvas"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-auto bg-gradient-to-br from-slate-50 to-slate-100"
      >
        <div
          className="relative inline-block"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Select Layer */}
          <canvas
            ref={selectCanvasRef}
            className="absolute inset-0 cursor-crosshair"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
            }}
          />

          {/* Hand Layer */}
          <canvas
            ref={handCanvasRef}
            className="absolute inset-0"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
            }}
          />

          {/* Main Layer */}
          <canvas
            ref={mainCanvasRef}
            className="relative bg-white"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
            }}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-muted/30 border-t border-border px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <div>
          {canvasWidth}x{canvasHeight}px
        </div>
        <div className="flex items-center gap-2">
          {isPlaying ? '▶ Playing' : '⏸ Paused'}
          {progress > 0 && <span className="text-xs">• {Math.round(progress)}ms</span>}
        </div>
        <div>
          Speed: {Math.round((speed / 40) * 100)}%
        </div>
      </div>
    </div>
  );
};
