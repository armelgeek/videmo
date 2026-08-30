'use client';

import { Music, Volume2, VolumeX } from 'lucide-react';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { ClipWaveform } from '@/lib/editor/components/clip-waveform';
import { TRACK_HEADER_PX } from '../timeline/annotation-timeline';

/**
 * A dedicated narration track lane below the annotation timeline — visually
 * the same language as the video editor's audio track (emerald clip,
 * waveform, mute + volume in the header gutter), but driven by
 * whiteboardConfig.audio rather than the editor's own clip/track model:
 * the annotation timeline has a single fixed, derived-from-annotations
 * track and explicitly no source media (see use-annotation-timeline.ts),
 * so the narration track is kept separate rather than forced into it.
 */
export function AudioTrackRow() {
  const audio = useStoryboardStore((s) => s.whiteboardConfig.audio);
  const setAudioTrack = useStoryboardStore((s) => s.setAudioTrack);

  const handleMuteToggle = () => {
    if (!audio) return;
    setAudioTrack({ ...audio, muted: !audio.muted });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audio) return;
    setAudioTrack({ ...audio, volume: Number(e.target.value) });
  };

  return (
    <div className="shrink-0 flex h-16 border-t border-white/10 bg-black">
      {/* Header gutter — aligned with the annotation timeline's track headers. */}
      <div
        className="shrink-0 flex flex-col justify-center gap-1.5 px-3 py-2 border-r border-white/10"
        style={{ width: TRACK_HEADER_PX }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Music className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 truncate">
            Audio 1
          </span>
        </div>
        {audio && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleMuteToggle}
              className="shrink-0 text-zinc-400 hover:text-zinc-200"
              aria-label={audio.muted ? 'Unmute' : 'Mute'}
            >
              {audio.muted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={audio.volume}
              disabled={audio.muted}
              onChange={handleVolumeChange}
              className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        )}
      </div>

      {/* Clip lane */}
      <div className="flex-1 min-w-0 relative bg-zinc-950/60 p-1">
        {audio ? (
          <div
            className={`relative w-full h-full rounded border overflow-hidden ${
              audio.muted
                ? 'bg-emerald-900/15 border-emerald-900/40 opacity-50'
                : 'bg-emerald-900/40 border-emerald-400'
            }`}
          >
            <span className="absolute top-0.5 left-1.5 z-10 text-[10px] font-medium text-emerald-100 truncate max-w-[calc(100%-0.75rem)] drop-shadow-md">
              {audio.name}
            </span>
            <div className="absolute inset-x-1 bottom-0.5 top-4">
              <ClipWaveform
                mediaUrl={audio.url}
                duration={audio.durationMs / 1000}
                offset={0}
                isAudio
                isSelected={false}
                zoomLevel={1}
              />
            </div>
          </div>
        ) : (
          <div className="w-full h-full rounded border border-dashed border-white/10 flex items-center justify-center text-[10px] text-zinc-500">
            No narration loaded
          </div>
        )}
      </div>
    </div>
  );
}
