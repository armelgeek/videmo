'use client';

import type React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { WhiteboardState, AnimationStyle, DrawingPath } from '../types';
import { Button } from '@/components/ui/button';
import {
  RotateCcw,
  Download,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';

interface WhiteboardCanvasProps {
  state: WhiteboardState;
  onStateChange: (state: Partial<WhiteboardState>) => void;
  readOnly?: boolean;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  state,
  onStateChange,
  readOnly = false,
}) => {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);
  const selCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const currentPathRef = useRef<DrawingPath | null>(null);

  // Initialize canvases with proper sizing
  useEffect(() => {
    const setupCanvas = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    setupCanvas(mainCanvasRef.current);
    setupCanvas(handCanvasRef.current);
    setupCanvas(selCanvasRef.current);
  }, []);

  // Drawing functions
  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (readOnly) return;

      const canvas = mainCanvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      currentPathRef.current = {
        points: [{ x, y }],
        strokeColor: '#000000',
        strokeWidth: 2,
        timestamp: Date.now(),
      };

      setIsDrawing(true);
    },
    [readOnly, zoom]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !currentPathRef.current) return;

      const canvas = mainCanvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      currentPathRef.current.points.push({ x, y });

      // Redraw canvas
      const ctx = canvas.getContext('2d');
      if (ctx && currentPathRef.current.points.length > 1) {
        const points = currentPathRef.current.points;
        const lastPoint = points[points.length - 2];
        const currentPoint = points[points.length - 1];

        ctx.strokeStyle = currentPathRef.current.strokeColor;
        ctx.lineWidth = currentPathRef.current.strokeWidth / zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
      }
    },
    [isDrawing, zoom]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    currentPathRef.current = null;
  }, []);

  // Control functions
  const handlePlayPause = () => {
    onStateChange({ playing: !state.playing });
  };

  const handleClear = () => {
    const canvas = mainCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    setZoom((z) => (direction === 'in' ? Math.min(z + 0.2, 3) : Math.max(z - 0.2, 0.5)));
  };

  const handleDownload = async () => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `whiteboard-${Date.now()}.png`;
    link.click();
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
            title={state.playing ? 'Pause' : 'Play'}
          >
            {state.playing ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <div className="text-xs text-muted-foreground">
            {state.playing ? 'Playing' : 'Paused'}
          </div>
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
            onClick={handleDownload}
            title="Download as image"
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
      <div className="flex-1 relative overflow-auto bg-gradient-to-br from-slate-50 to-slate-100">
        <div
          className="relative inline-block"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Selection Layer */}
          <canvas
            ref={selCanvasRef}
            className="absolute inset-0 cursor-crosshair"
            style={{
              width: `${state.canvasWidth}px`,
              height: `${state.canvasHeight}px`,
            }}
          />

          {/* Hand/Interaction Layer */}
          <canvas
            ref={handCanvasRef}
            className="absolute inset-0"
            style={{
              width: `${state.canvasWidth}px`,
              height: `${state.canvasHeight}px`,
            }}
          />

          {/* Main Drawing Layer */}
          <canvas
            ref={mainCanvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="relative bg-white cursor-crosshair"
            style={{
              width: `${state.canvasWidth}px`,
              height: `${state.canvasHeight}px`,
            }}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-muted/30 border-t border-border px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <div>
          {state.canvasWidth}x{state.canvasHeight}px
        </div>
        <div>
          Time: {Math.round(state.currentTime)}ms / {state.duration}ms
        </div>
        <div>{state.animationStyle}</div>
      </div>
    </div>
  );
};
