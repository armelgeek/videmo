'use client';

import { Music, Volume2, VolumeX, Mic2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { ClipWaveform } from '@/lib/editor/components/clip-waveform';
import { NarrationGenerationModal } from './narration-generation-modal';
import { TRACK_HEADER_PX } from '../timeline/annotation-timeline';
import type { Annotation } from '../schema';

/**
 * A dedicated narration track lane below the annotation timeline — visually
 * the same language as the video editor's audio track (emerald clip,
 * waveform, mute + volume in the header gutter), but driven by
 * whiteboardConfig.audio rather than the editor's own clip/track model:
 * the annotation timeline has a single fixed, derived-from-annotations
 * track and explicitly no source media (see use-annotation-timeline.ts),
 * so the narration track is kept separate rather than forced into it.
 */
export interface AudioTrackRowProps {
  /**
   * The timeline's horizontal viewport. Supplied, the lane adopts the ruler's
   * pixels-per-second and scroll offset; omitted, it falls back to filling the
   * available width.
   */
  viewport?: {
    scrollEl: HTMLElement | null;
    contentWidth: number;
    zoomLevel: number;
  };
}

export function AudioTrackRow({ viewport }: AudioTrackRowProps = {}) {
  // The lane follows the timeline's scroll imperatively. Auto-scroll during
  // playback fires ~22 times a second; routing that through state re-rendered
  // this whole subtree at the same rate for what is one CSS transform.
  const laneRef = useRef<HTMLDivElement>(null);
  const scrollEl = viewport?.scrollEl ?? null;
  const zoomLevel = viewport?.zoomLevel ?? 0;
  useEffect(() => {
    const apply = () => {
      const offset = scrollEl?.scrollLeft ?? 0;
      if (laneRef.current) {
        laneRef.current.style.transform = `translateX(${-offset}px)`;
      }
    };
    apply();
    scrollEl?.addEventListener('scroll', apply, { passive: true });
    return () => scrollEl?.removeEventListener('scroll', apply);
  }, [scrollEl, viewport?.contentWidth, zoomLevel]);

  const audio = useStoryboardStore((s) => s.whiteboardConfig.audio);
  const narration = useStoryboardStore((s) => s.whiteboardConfig.narration);
  const setAudioTrack = useStoryboardStore((s) => s.setAudioTrack);
  const annotations = useStoryboardStore((s) => s.whiteboardConfig.annotations);
  const updateAnnotation = useStoryboardStore((s) => s.updateAnnotation);
  const selectedVoice = useStoryboardStore((s) => s.selectedVoice);

  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [selectedAnnotationForNarration, setSelectedAnnotationForNarration] = useState<Annotation | null>(null);

  const handleMuteToggle = () => {
    if (!audio) return;
    setAudioTrack({ ...audio, muted: !audio.muted });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audio) return;
    setAudioTrack({ ...audio, volume: Number(e.target.value) });
  };

  /**
   * Ce qu'il y a a dessiner sur la piste.
   *
   * La voix produite par la chaine vit dans `narration` : un enregistrement,
   * ou quelques-uns si le script a du etre coupe. `audio` reste la piste d'un
   * televersement a la main. Ne lire que la seconde laissait la piste vide —
   * sans forme d'onde — alors que la lecture, elle, fonctionnait.
   */
  const morceaux = narration?.length
    ? narration.map((part, i) => ({
        key: `narration-${i}`,
        url: part.url,
        startMs: part.startMs,
        durationMs: part.durationMs,
        nom: narration.length > 1 ? `Narration ${i + 1}` : 'Narration',
      }))
    : audio
      ? [{
          key: 'audio',
          url: audio.url,
          startMs: audio.offsetMs,
          durationMs: audio.durationMs,
          nom: audio.name,
        }]
      : [];

  const dureeTotaleMs = morceaux.reduce(
    (fin, m) => Math.max(fin, m.startMs + m.durationMs),
    0,
  );

  // Calculate annotation positions relative to audio timeline
  const getAnnotationPositions = () => {
    if (dureeTotaleMs <= 0) return [];

    return annotations.map((ann) => {
      const startPercent = (ann.reveal.from || 0) / dureeTotaleMs * 100;
      const endPercent = ((ann.reveal.from || 0) + (ann.reveal.durationMs || 0)) / dureeTotaleMs * 100;
      return {
        ...ann,
        startPercent: Math.max(0, startPercent),
        endPercent: Math.min(100, endPercent),
      };
    });
  };

  const annotationPositions = getAnnotationPositions();

  const handleNarrationGenerated = (updatedAnnotation: Annotation) => {
    updateAnnotation(updatedAnnotation.id, { narration: updatedAnnotation.narration });
  };

  return (
    <>
      {/* Narration Generation Modal */}
      {selectedAnnotationForNarration && (
        <NarrationGenerationModal
          annotation={selectedAnnotationForNarration}
          selectedVoiceId={selectedVoice}
          isOpen={!!selectedAnnotationForNarration}
          onClose={() => setSelectedAnnotationForNarration(null)}
          onGenerated={handleNarrationGenerated}
        />
      )}
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

      {/* Clip lane. It mirrors the timeline's scroll content rather than
          filling the width: the clip has to sit under the same pixels as the
          ruler above, or the playhead drifts away from it on zoom/scroll. */}
      <div className="flex-1 min-w-0 relative bg-zinc-950/60 py-1 overflow-hidden">
        {morceaux.length > 0 ? (
          <div
            ref={laneRef}
            className="relative h-full"
            style={viewport ? { width: viewport.contentWidth } : { width: '100%' }}
          >
          {morceaux.map((morceau) => (
          <div
            key={morceau.key}
            className={`absolute top-0 bottom-0 rounded border overflow-hidden ${
              audio?.muted
                ? 'bg-emerald-900/15 border-emerald-900/40 opacity-50'
                : 'bg-emerald-900/40 border-emerald-400'
            }`}
            style={
              viewport
                ? {
                    left: (morceau.startMs / 1000) * viewport.zoomLevel,
                    width: (morceau.durationMs / 1000) * viewport.zoomLevel,
                  }
                : {
                    left: `${(morceau.startMs / dureeTotaleMs) * 100}%`,
                    width: `${(morceau.durationMs / dureeTotaleMs) * 100}%`,
                  }
            }
          >
            <span className="absolute top-0.5 left-1.5 z-10 text-[10px] font-medium text-emerald-100 truncate max-w-[calc(100%-0.75rem)] drop-shadow-md">
              {morceau.nom}
            </span>
            <div className="absolute inset-x-1 bottom-0.5 top-4">
              <ClipWaveform
                mediaUrl={morceau.url}
                duration={morceau.durationMs / 1000}
                offset={0}
                isAudio
                isSelected={false}
                zoomLevel={1}
              />
            </div>
          </div>
          ))}

          {/* Les annotations, posees sur l'horloge du projet et non sur un
              enregistrement : plusieurs images en partagent un seul. */}
          {annotationPositions.length > 0 && (
            <div className="absolute bottom-0 inset-x-0 pointer-events-none flex h-3">
              {annotationPositions.map((ann, idx) => (
                <div
                  key={ann.id}
                  className={`relative transition-all cursor-pointer ${idx > 0 ? 'border-l border-white/20' : ''}`}
                  style={{
                    left: `${ann.startPercent}%`,
                    width: `${ann.endPercent - ann.startPercent}%`,
                    backgroundColor: ann.narration?.audioUrl
                      ? 'rgba(34, 197, 94, 0.5)'
                      : 'rgba(255, 255, 255, 0.1)',
                  }}
                  onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                  onMouseLeave={() => setHoveredAnnotationId(null)}
                >
                  {hoveredAnnotationId === ann.id && (
                    <div className="absolute -top-6 left-0 bg-black/80 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-auto">
                      {ann.text || `Annotation ${idx + 1}`}
                    </div>
                  )}

                  {hoveredAnnotationId === ann.id && (
                    <button
                      onClick={() => setSelectedAnnotationForNarration(ann)}
                      className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 hover:bg-black/80 transition-colors"
                      title={ann.narration?.audioUrl ? 'Regenerate narration' : 'Generate narration'}
                    >
                      <Mic2 className="w-2.5 h-2.5 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        ) : (
          <div className="w-full h-full rounded border border-dashed border-white/10 flex items-center justify-center text-[10px] text-zinc-500">
            No narration loaded
          </div>
        )}
      </div>
    </div>
    </>
  );
}
