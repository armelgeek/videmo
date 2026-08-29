'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

interface InkplainerSidebarProps {
  selectedLayerName?: string;
  animStyle: string;
  onAnimStyleChange: (style: string) => void;
  handStyle: string;
  onHandStyleChange: (hand: string) => void;
  revealSpeed: number;
  onRevealSpeedChange: (speed: number) => void;
  handSpeed: number;
  onHandSpeedChange: (speed: number) => void;
  chunks?: number;
  onChunksChange?: (chunks: number) => void;
  aspectRatio?: string;
  onAspectRatioChange?: (ratio: string) => void;
  resolution?: string;
  onResolutionChange?: (res: string) => void;
  activeTab?: 'animation' | 'drawing' | 'scenes' | 'annotation';
  onActiveTabChange?: (tab: 'animation' | 'drawing' | 'scenes' | 'annotation') => void;
  useAnnotation?: boolean;
  onToggleAnnotation?: (enabled: boolean) => void;
  annotations?: any[];
  onGenerateAnimation: () => void;
}

export const InkplainerSidebar: React.FC<InkplainerSidebarProps> = ({
  selectedLayerName = 'scene-premium-bag',
  animStyle,
  onAnimStyleChange,
  handStyle,
  onHandStyleChange,
  revealSpeed,
  onRevealSpeedChange,
  handSpeed,
  onHandSpeedChange,
  chunks = 30,
  onChunksChange,
  aspectRatio = '16:9',
  onAspectRatioChange,
  resolution = '720p',
  onResolutionChange,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  useAnnotation = false,
  onToggleAnnotation,
  annotations = [],
  onGenerateAnimation,
}) => {
  const [internalTab, setInternalTab] = useState<'animation' | 'drawing' | 'scenes' | 'annotation'>('animation');
  const activeTab = controlledActiveTab ?? internalTab;
  const setTab = (t: 'animation' | 'drawing' | 'scenes' | 'annotation') => {
    if (onActiveTabChange) onActiveTabChange(t);
    else setInternalTab(t);
  };

  const animStyles = [
    { key: 'contour', label: 'Contour' },
    { key: 'outline-chunks', label: 'Outline Chunks' },
    { key: 'chunk-jump', label: 'Chunk Jump' },
    { key: 'outline-fill', label: 'Outline + Fill' },
    { key: 'nervous', label: 'Nervous' },
    { key: 'top-anchor', label: 'Top Anchor' },
    { key: 'scribble', label: 'Scribble' },
    { key: 'gesture', label: 'Gesture' },
    { key: 'illust-fill', label: 'Illust Fill' },
    { key: 'scanner', label: 'Scanner' },
    { key: 'spec-text', label: 'Spec Text' },
  ];

  const handStyles = [
    { key: 'custom1', label: 'Pencil Hand (Male)' },
    { key: 'custom2', label: 'Marker Hand (Female)' },
    { key: 'custom3', label: 'Chalk Hand' },
    { key: 'custom4', label: 'Stylus Hand' },
  ];

  return (
    <aside className="w-[310px] shrink-0 border-r border-border bg-card flex flex-col h-full overflow-hidden select-none">
      {/* Tabs Header */}
      <div className="flex border-b border-border bg-muted/40">
        <button
          onClick={() => setTab('animation')}
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'animation' ? 'border-primary text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Animation
        </button>
        <button
          onClick={() => setTab('drawing')}
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'drawing' ? 'border-primary text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Drawing
        </button>
        <button
          onClick={() => setTab('scenes')}
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'scenes' ? 'border-primary text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Scenes
        </button>
        <button
          onClick={() => setTab('annotation')}
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'annotation' ? 'border-primary text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Annotate
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'animation' && (
          <>
            {/* Style Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Animation Style
              </label>
              <select
                value={animStyle}
                onChange={(e) => onAnimStyleChange(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {animStyles.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Hand Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Hand Model
              </label>
              <select
                value={handStyle}
                onChange={(e) => onHandStyleChange(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {handStyles.map((h) => (
                  <option key={h.key} value={h.key}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Speed Controls */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span>Reveal Speed</span>
                  <span className="text-muted-foreground">{revealSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={revealSpeed}
                  onChange={(e) => onRevealSpeedChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span>Hand Speed</span>
                  <span className="text-muted-foreground">{handSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={handSpeed}
                  onChange={(e) => onHandSpeedChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {onChunksChange && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Stroke Chunks</span>
                    <span className="text-muted-foreground">{chunks}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={chunks}
                    onChange={(e) => onChunksChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              )}
            </div>

            {/* Canvas Settings */}
            <div className="space-y-3 border-t border-border pt-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Format & Resolution
              </label>
              <div className="grid grid-cols-2 gap-2">
                {onAspectRatioChange && (
                  <select
                    value={aspectRatio}
                    onChange={(e) => onAspectRatioChange(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1.5 text-xs font-medium"
                  >
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Portrait</option>
                    <option value="1:1">1:1 Square</option>
                  </select>
                )}
                {onResolutionChange && (
                  <select
                    value={resolution}
                    onChange={(e) => onResolutionChange(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1.5 text-xs font-medium"
                  >
                    <option value="720p">720p HD</option>
                    <option value="1080p">1080p Full HD</option>
                  </select>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'drawing' && (
          <div className="space-y-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Stroke & Contour Parameters</p>
            <p>Customize contour threshold, stroke weight, and fill density for vector graphics.</p>
          </div>
        )}

        {activeTab === 'scenes' && (
          <div className="space-y-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Scene Layers</p>
            <div className="p-2 border border-border rounded bg-muted/20 text-foreground font-mono text-xs">
              {selectedLayerName}
            </div>
          </div>
        )}

        {activeTab === 'annotation' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Enable Annotations</span>
              <input
                type="checkbox"
                checked={useAnnotation}
                onChange={(e) => onToggleAnnotation?.(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </div>

            {annotations.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Active Annotations ({annotations.length})
                </p>
                {annotations.map((ann, idx) => (
                  <div key={idx} className="p-2 border border-border rounded bg-muted/10 text-xs">
                    <span className="font-semibold text-primary">{ann.label || `Annot #${idx + 1}`}</span>
                    <span className="block text-[10px] text-muted-foreground font-mono">
                      {ann.reveal?.from}ms → {ann.reveal?.to}ms
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">No annotations found in active scene.</p>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-border bg-card">
        <Button onClick={onGenerateAnimation} className="w-full flex items-center justify-center gap-2">
          <Play className="w-4 h-4" />
          <span>Render Animation</span>
        </Button>
      </div>
    </aside>
  );
};