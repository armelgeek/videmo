'use client';

import React from 'react';
import { Layers, Eye, Upload } from 'lucide-react';

interface InkplainerRightPanelProps {
  canvasBg: string;
  onCanvasBgChange: (bg: string) => void;
  layers?: any[];
  onLayersChange?: (layers: any[]) => void;
}

export const InkplainerRightPanel: React.FC<InkplainerRightPanelProps> = ({
  canvasBg,
  onCanvasBgChange,
  layers = [],
}) => {
  return (
    <aside className="w-[296px] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden select-none">
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Background & Scene Setup
        </h3>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            value={canvasBg}
            onChange={(e) => onCanvasBgChange(e.target.value)}
            className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
          />
          <span className="text-xs font-mono">{canvasBg}</span>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Layers ({layers.length})
          </span>
          <Upload className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
        </div>

        <div className="space-y-2">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className="flex items-center justify-between p-2 rounded border border-border bg-muted/10 text-xs font-medium"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>{layer.name}</span>
              </div>
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};