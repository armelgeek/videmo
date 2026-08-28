'use client';

import type React from 'react';
import type { WhiteboardState, AnimationStyle } from '../types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

interface WhiteboardSettingsProps {
  state: WhiteboardState;
  onStateChange: (state: Partial<WhiteboardState>) => void;
}

const ANIMATION_STYLES: AnimationStyle[] = [
  'scanner',
  'contour',
  'outlinechunks',
  'chunkjump',
  'outlinefill',
  'nervous',
  'topanchor',
  'scribble',
  'specialized',
  'gesture',
  'illustfill',
  'outlineonly',
  'spec-text',
  'spec-human',
  'spec-animal',
  'spec-portrait',
];

export const WhiteboardSettings: React.FC<WhiteboardSettingsProps> = ({
  state,
  onStateChange,
}) => {
  const handleStyleChange = (style: AnimationStyle) => {
    onStateChange({ animationStyle: style });
  };

  const handleSpeedChange = (speed: number) => {
    onStateChange({ speed });
  };

  const handleLineColorChange = (color: string) => {
    onStateChange({
      animationOptions: {
        ...state.animationOptions,
        lineColor: color,
      },
    });
  };

  const handleLineWidthChange = (width: number) => {
    onStateChange({
      animationOptions: {
        ...state.animationOptions,
        lineWidth: width,
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Canvas Settings */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-sm">Canvas</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Width (px)</Label>
            <div className="text-sm font-mono text-muted-foreground">
              {state.canvasWidth}
            </div>
          </div>
          <div>
            <Label className="text-xs">Height (px)</Label>
            <div className="text-sm font-mono text-muted-foreground">
              {state.canvasHeight}
            </div>
          </div>
        </div>
      </Card>

      {/* Animation Style */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-sm">Animation Style</h3>

        <Select
          value={state.animationStyle}
          onValueChange={(val) => handleStyleChange(val as AnimationStyle)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select animation style" />
          </SelectTrigger>
          <SelectContent>
            {ANIMATION_STYLES.map((style) => (
              <SelectItem key={style} value={style}>
                {style}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-xs text-muted-foreground">
          Current: <code className="bg-muted px-2 py-1 rounded">{state.animationStyle}</code>
        </div>
      </Card>

      {/* Animation Options */}
      <Card className="p-4 space-y-6">
        <h3 className="font-semibold text-sm">Drawing Options</h3>

        {/* Speed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Animation Speed</Label>
            <span className="text-sm font-mono text-muted-foreground">
              {state.speed}x
            </span>
          </div>
          <Slider
            value={[state.speed]}
            onValueChange={([val]) => handleSpeedChange(val)}
            min={0.25}
            max={2}
            step={0.25}
            className="w-full"
          />
        </div>

        {/* Line Color */}
        <div className="space-y-2">
          <Label className="text-xs">Line Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={state.animationOptions.lineColor || '#000000'}
              onChange={(e) => handleLineColorChange(e.target.value)}
              className="w-10 h-10 rounded border border-border cursor-pointer"
            />
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
              {state.animationOptions.lineColor || '#000000'}
            </code>
          </div>
        </div>

        {/* Line Width */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Line Width</Label>
            <span className="text-sm font-mono text-muted-foreground">
              {state.animationOptions.lineWidth || 2}px
            </span>
          </div>
          <Slider
            value={[state.animationOptions.lineWidth || 2]}
            onValueChange={([val]) => handleLineWidthChange(val)}
            min={0.5}
            max={10}
            step={0.5}
            className="w-full"
          />
        </div>
      </Card>

      {/* Playback */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-sm">Playback</h3>

        <div className="text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span>Duration:</span>
            <code className="bg-muted px-2 py-1 rounded">
              {Math.round(state.duration)}ms
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span>Current Time:</span>
            <code className="bg-muted px-2 py-1 rounded">
              {Math.round(state.currentTime)}ms
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span>Status:</span>
            <code className="bg-muted px-2 py-1 rounded">
              {state.playing ? '▶ Playing' : '⏸ Paused'}
            </code>
          </div>
        </div>
      </Card>

      {/* Info */}
      <Card className="p-4 space-y-2">
        <h3 className="font-semibold text-sm">Help</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Draw on the canvas using your mouse</p>
          <p>• Change animation style to create different effects</p>
          <p>• Adjust speed for faster/slower playback</p>
          <p>• Customize line color and width</p>
        </div>
      </Card>
    </div>
  );
};
