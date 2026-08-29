'use client';

import React from 'react';

export const InkplainerTimeline: React.FC = () => {
  return (
    <div id="timeline-bar" className="shrink-0 bg-white border-t border-border px-4 py-2 select-none">
      {/* Timeline Header */}
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-[9px] font-bold tracking-wider uppercase text-muted-foreground">Timeline</span>
        <span className="text-[10px] font-mono bg-muted/40 border border-border px-2 py-0.5 rounded text-foreground">
          0:00.0 / 0:00.0
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">0 scènes</span>
      </div>

      {/* Ruler and Tracks */}
      <div className="space-y-1">
        {/* Ruler */}
        <div className="h-3 border-b border-border relative text-[8px] font-mono text-muted-foreground">
          <span className="absolute left-0">0.0s</span>
          <span className="absolute left-1/4">2.5s</span>
          <span className="absolute left-1/2">5.0s</span>
          <span className="absolute left-3/4">7.5s</span>
        </div>

        {/* Scene Track */}
        <div className="h-8 bg-slate-50 border border-dashed border-border rounded-md flex items-center justify-center text-xs text-muted-foreground">
          Aucune scène — Onglet Scènes → Ajouter une Scène
        </div>

        {/* Audio Narration Track */}
        <div className="h-6 bg-slate-50 border border-dashed border-border rounded-md flex items-center px-3 text-[10px] text-muted-foreground">
          Aucune narration — Onglet Scènes → Narration
        </div>
      </div>
    </div>
  );
};
