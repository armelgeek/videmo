'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { isPremiumStyle } from '../style-tiers';
import { HAND_STYLES } from '../hand-styles';
import { useCreditSummary } from '@/lib/billing/use-credit-summary';

interface InkplainerSidebarProps {
  selectedLayerName?: string;
  animStyle: string;
  onAnimStyleChange: (style: string) => void;
  handStyle: string;
  onHandStyleChange: (hand: string) => void;
  activeTab?: 'animation' | 'drawing' | 'scenes' | 'annotation';
  onActiveTabChange?: (tab: 'animation' | 'drawing' | 'scenes' | 'annotation') => void;
  annotations?: any[];
  onGenerateAnimation: () => void;
}

export const InkplainerSidebar: React.FC<InkplainerSidebarProps> = ({
  selectedLayerName = 'scene-premium-bag',
  animStyle,
  onAnimStyleChange,
  handStyle,
  onHandStyleChange,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  annotations = [],
  onGenerateAnimation,
}) => {
  const [internalTab, setInternalTab] = useState<'animation' | 'drawing' | 'scenes' | 'annotation'>('animation');
  const activeTab = controlledActiveTab ?? internalTab;
  const setTab = (t: 'animation' | 'drawing' | 'scenes' | 'annotation') => {
    if (onActiveTabChange) onActiveTabChange(t);
    else setInternalTab(t);
  };

  const { summary } = useCreditSummary();
  const premiumLocked = summary ? !summary.features.premiumStyles : false;

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

  const handStyles = HAND_STYLES;

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
                {animStyles.map((s) => {
                  const pro = isPremiumStyle(s.key);
                  return (
                    <option key={s.key} value={s.key} disabled={pro && premiumLocked && s.key !== animStyle}>
                      {s.label}
                      {pro ? ' · Pro' : ''}
                    </option>
                  );
                })}
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
            <p className="text-xs font-medium text-foreground">Active Annotations</p>

            {annotations.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  ({annotations.length} annotations)
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