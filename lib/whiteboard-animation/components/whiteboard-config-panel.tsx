'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { WhiteboardConfig } from '@/lib/storyboard/store';

interface WhiteboardConfigPanelProps {
  config: WhiteboardConfig;
  onChange: (config: Partial<WhiteboardConfig>) => void;
}

export function WhiteboardConfigPanel({
  config,
  onChange,
}: WhiteboardConfigPanelProps) {
  return (
    <div className="space-y-6 p-6 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Whiteboard Settings</h3>

      {/* Animation Style */}
      <div className="grid gap-2">
        <Label>Animation Style</Label>
        <Select
          value={config.animStyle}
          onValueChange={(val) => onChange({ animStyle: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chunkjump">ChunkJump</SelectItem>
            <SelectItem value="contour">Contour</SelectItem>
            <SelectItem value="gesture">Gesture</SelectItem>
            <SelectItem value="illust">Illustration</SelectItem>
            <SelectItem value="nervous">Nervous</SelectItem>
            <SelectItem value="outlinechunks">Outline Chunks</SelectItem>
            <SelectItem value="outlinefill">Outline Fill</SelectItem>
            <SelectItem value="outlineonly">Outline Only</SelectItem>
            <SelectItem value="scanner">Scanner</SelectItem>
            <SelectItem value="scribble">Scribble</SelectItem>
            <SelectItem value="spec-text">Spec Text</SelectItem>
            <SelectItem value="specialized">Specialized</SelectItem>
            <SelectItem value="topanchor">Top Anchor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hand Style */}
      <div className="grid gap-2">
        <Label>Hand Style</Label>
        <Select
          value={config.handStyle}
          onValueChange={(val) => onChange({ handStyle: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom1">Hand 1</SelectItem>
            <SelectItem value="custom2">Hand 2</SelectItem>
            <SelectItem value="custom3">Hand 3</SelectItem>
            <SelectItem value="custom4">Hand 4</SelectItem>
            <SelectItem value="ghost">Ghost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reveal Speed */}
      <div className="grid gap-3">
        <div className="flex justify-between items-center">
          <Label>Reveal Speed</Label>
          <span className="text-sm font-medium text-muted-foreground">
            {config.revealSpeed}
          </span>
        </div>
        <Slider
          value={[config.revealSpeed]}
          onValueChange={([val]) => onChange({ revealSpeed: val })}
          min={10}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* Hand Speed */}
      <div className="grid gap-3">
        <div className="flex justify-between items-center">
          <Label>Hand Speed</Label>
          <span className="text-sm font-medium text-muted-foreground">
            {config.handSpeed}
          </span>
        </div>
        <Slider
          value={[config.handSpeed]}
          onValueChange={([val]) => onChange({ handSpeed: val })}
          min={1}
          max={20}
          step={1}
          className="w-full"
        />
      </div>

      {/* Chunks */}
      <div className="grid gap-3">
        <div className="flex justify-between items-center">
          <Label>Chunks</Label>
          <span className="text-sm font-medium text-muted-foreground">
            {config.chunks}
          </span>
        </div>
        <Slider
          value={[config.chunks]}
          onValueChange={([val]) => onChange({ chunks: val })}
          min={10}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* Canvas Background */}
      <div className="grid gap-2">
        <Label>Canvas Background</Label>
        <Select
          value={config.canvasBg}
          onValueChange={(val) => onChange({ canvasBg: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="white">White</SelectItem>
            <SelectItem value="black">Black</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Use Annotations */}
      <div className="flex items-center justify-between">
        <Label>Show Annotations</Label>
        <Switch
          checked={config.useAnnotation}
          onCheckedChange={(checked) =>
            onChange({ useAnnotation: checked })
          }
        />
      </div>

      {/* Aspect Ratio */}
      <div className="grid gap-2">
        <Label>Aspect Ratio</Label>
        <Select
          value={config.aspectRatio}
          onValueChange={(val: any) => onChange({ aspectRatio: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9</SelectItem>
            <SelectItem value="9:16">9:16</SelectItem>
            <SelectItem value="1:1">1:1</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resolution */}
      <div className="grid gap-2">
        <Label>Resolution</Label>
        <Select
          value={config.resolution}
          onValueChange={(val: any) => onChange({ resolution: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="720p">720p</SelectItem>
            <SelectItem value="1080p">1080p</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
