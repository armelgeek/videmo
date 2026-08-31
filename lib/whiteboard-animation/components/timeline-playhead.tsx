'use client';

import { useRef, useEffect } from 'react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import { TRACK_HEADER_PX } from '../timeline/annotation-timeline';

export function TimelinePlayhead() {
  const { currentTime, duration, setCurrentTime } = useUnifiedEngine();
  const playheadRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Find the relative container (parent)
    if (playheadRef.current) {
      containerRef.current = playheadRef.current.parentElement;
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left - TRACK_HEADER_PX;
      const widthAvailable = rect.width - TRACK_HEADER_PX;
      const newTime = Math.max(0, Math.min((x / widthAvailable) * duration, duration));
      setCurrentTime(newTime);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (duration === 0) return null;

  const percentProgress = (currentTime / duration) * 100;
  const gutterWidth = TRACK_HEADER_PX;

  return (
    <div
      ref={playheadRef}
      className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-500 pointer-events-auto z-20 shadow-lg cursor-col-resize"
      style={{
        left: `calc(${gutterWidth}px + ${percentProgress}%)`,
        boxShadow: '0 0 8px rgba(96, 165, 250, 0.8)',
        transform: 'translateX(-50%)',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Top marker */}
      <div className="absolute -top-1 -left-2 w-5 h-3 bg-blue-500 rounded-t border border-blue-300" />
    </div>
  );
}
