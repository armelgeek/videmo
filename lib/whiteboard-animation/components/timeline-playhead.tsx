'use client';

import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import { TRACK_HEADER_PX } from '../timeline/annotation-timeline';

export function TimelinePlayhead() {
  const { currentTime, duration } = useUnifiedEngine();

  if (duration === 0) return null;

  const percentProgress = (currentTime / duration) * 100;
  // Account for track header gutter offset
  const gutterWidth = TRACK_HEADER_PX;

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-blue-500 pointer-events-none z-20 shadow-lg"
      style={{
        left: `calc(${gutterWidth}px + ${percentProgress}%)`,
        boxShadow: '0 0 8px rgba(96, 165, 250, 0.8)',
      }}
    >
      {/* Top marker */}
      <div className="absolute -top-1 -left-1.5 w-4 h-3 bg-blue-500 rounded-t border border-blue-300" />
    </div>
  );
}
