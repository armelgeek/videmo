'use client';

import { useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { useToastContext } from '@/components/ui/sonner';
import type { AudioTrack } from '../audio/types';

export function AudioPanel() {
  const audio = useStoryboardStore((s) => s.whiteboardConfig.audio);
  const setAudioTrack = useStoryboardStore((s) => s.setAudioTrack);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToastContext();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const el = new Audio(url);
    el.addEventListener('loadedmetadata', () => {
      const track: AudioTrack = {
        id: `audio-${Date.now()}`,
        url,
        source: 'upload',
        volume: 1,
        muted: false,
        offsetMs: 0,
        durationMs: el.duration * 1000,
      };
      setAudioTrack(track);
    });
    // Without this, a load failure (bad codec, blocked by CSP, network
    // error) leaves the panel silently stuck on the upload input forever —
    // see docs/superpowers/specs/2026-07-29-whiteboard-audio-design.md's
    // error table ("Échec de chargement -> Toast d'erreur").
    el.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      toast.error('Failed to load audio file');
    });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audio) return;
    setAudioTrack({ ...audio, volume: Number(e.target.value) });
  };

  const handleMuteToggle = () => {
    if (!audio) return;
    setAudioTrack({ ...audio, muted: !audio.muted });
  };

  const handleClear = () => {
    if (audio?.url.startsWith('blob:')) {
      URL.revokeObjectURL(audio.url);
    }
    setAudioTrack(null);
  };

  return (
    <div className="space-y-4 p-6 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Narration</h3>

      {!audio ? (
        <div className="grid gap-2">
          <Label>Upload audio</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="text-sm"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {(audio.durationMs / 1000).toFixed(1)}s loaded
            </span>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Remove
            </Button>
          </div>

          <div className="grid gap-2">
            <div className="flex justify-between text-xs font-medium">
              <span>Volume</span>
              <span className="text-muted-foreground">
                {Math.round(audio.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={audio.volume}
              onChange={handleVolumeChange}
              disabled={audio.muted}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Muted</Label>
            <input
              type="checkbox"
              checked={audio.muted}
              onChange={handleMuteToggle}
              className="w-4 h-4 accent-primary rounded cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
