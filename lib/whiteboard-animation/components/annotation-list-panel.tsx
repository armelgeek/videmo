'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import { selectSceneAnnotations } from '@/lib/unified-engine/hooks/selectors';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { deriveTimeline } from '../timeline/derive-timeline';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_ANIM_STYLE, annotationColors } from '../schema';

/** Couleur de repli du calque d'annotations — meme valeur qu'AnnotationOverlay. */

const ANIM_STYLES = [
  { value: 'chunkjump', label: 'Chunk Jump' },
  { value: 'contour', label: 'Contour' },
  { value: 'gesture', label: 'Gesture' },
  { value: 'illust', label: 'Illustration' },
  { value: 'nervous', label: 'Nervous' },
  { value: 'outlinechunks', label: 'Outline Chunks' },
  { value: 'outlinefill', label: 'Outline Fill' },
  { value: 'outlineonly', label: 'Outline Only' },
  { value: 'scanner', label: 'Scanner' },
  { value: 'scribble', label: 'Scribble' },
  { value: 'specialized', label: 'Specialized' },
  { value: 'topanchor', label: 'Top Anchor' },
] as const;

function formatMs(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function AnnotationListPanelImpl({
  className,
  annotations: annotationsProp,
  sceneOffsetMs = 0,
}: {
  className?: string;
  annotations?: import('@/lib/unified-engine/types').Annotation[];
  /** Where the scene's drawing starts on the project clock; annotation times are local to it. */
  sceneOffsetMs?: number;
}) {
  // La scene active seulement : le store porte toutes les scenes a plat, et
  // les index de cette liste restent locaux a la scene.
  const storeAnnotations = useUnifiedEngineStore(selectSceneAnnotations);
  const updateAnnotation = useUnifiedEngineStore((s) => s.updateAnnotation);
  const annotations = annotationsProp ?? storeAnnotations;
  const selectedIndex = useUnifiedEngineStore(
    (s) => s.ui.selectedAnnotationIndex,
  );
  const setSelectedAnnotation = useUnifiedEngineStore(
    (s) => s.setSelectedAnnotation,
  );

  const derived = useMemo(
    () => deriveTimeline(annotations).annotations,
    [annotations],
  );

  // The clock ticks every frame; only a change of playing annotation re-renders.
  const [playingIndex, setPlayingIndex] = useState(-1);
  useEffect(() => {
    const place = () => {
      const t = useUnifiedEngineStore.getState().timeline.currentTime - sceneOffsetMs;
      const idx = derived.findIndex((a) => t >= a.reveal.from && t < a.reveal.to);
      setPlayingIndex((prev) => (prev === idx ? prev : idx));
    };
    place();
    return useUnifiedEngineStore.subscribe(place);
  }, [derived, sceneOffsetMs]);

  const selectAndSeek = (index: number, isSelected: boolean) => {
    if (isSelected) {
      setSelectedAnnotation(null);
      return;
    }
    setSelectedAnnotation(index);
    const engine = useUnifiedEngineStore.getState();
    if (engine.timeline.isPlaying) engine.setIsPlaying(false);
    engine.setCurrentTime(sceneOffsetMs + derived[index].reveal.from);
  };

  const handleStyleChange = (index: number, styleVal: string) => {
    const newStyle = styleVal === DEFAULT_ANIM_STYLE ? undefined : styleVal;
    updateAnnotation(index, { animStyle: newStyle });

    try {
      const storyboardState = useStoryboardStore.getState();
      const activeClipIndex = storyboardState.activeClipIndex;
      const activePanel = storyboardState.storyboardPanels[activeClipIndex];
      if (activePanel) {
        const updatedAnnotations = (activePanel.annotations ?? []).map((a: any, i: number) =>
          i === index ? { ...a, animStyle: newStyle } : a,
        );
        storyboardState.updatePanel(activePanel.id, {
          annotations: updatedAnnotations,
        });
      }
    } catch (e) {
      // Store non initialise dans certains environnements isoles
    }
  };

  return (
    <section className={cn('flex min-h-0 flex-col overflow-hidden', className)}>

      {derived.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">
          No annotations yet. Draw a region on the canvas to add one.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {derived.map((annotation, i) => {
            const selected = selectedIndex === i;
            const playing = playingIndex === i;
            const color = annotationColors(annotation, i).stroke;
            const currentAnimStyle = annotation.animStyle ?? DEFAULT_ANIM_STYLE;

            return (
              <li key={annotation.id ?? i} className="px-2 py-1">
                <div
                  onClick={() => selectAndSeek(i, selected)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-l-[3px] px-2.5 py-2 transition-colors',
                    selected ? 'bg-muted' : playing ? 'border-transparent bg-muted/60' : 'border-transparent hover:bg-muted/40',
                  )}
                  style={{
                    borderLeftColor: color,
                    ...(selected && { borderColor: `color-mix(in srgb, ${color} 55%, transparent)`, borderLeftColor: color }),
                  }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
                    style={{ color, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={cn('line-clamp-2 text-[13px] leading-snug', selected || playing ? 'font-medium text-foreground' : 'text-foreground/90')}>
                      {annotation.text || `Region ${i + 1}`}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-muted-foreground">
                      {formatMs(annotation.reveal.from)} → {formatMs(annotation.reveal.to)}
                    </span>
                  </div>
                  {playing && (
                    <span aria-label="Playing" className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: color }} />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    </span>
                  )}
                  {!selected && currentAnimStyle !== DEFAULT_ANIM_STYLE && (
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {ANIM_STYLES.find((st) => st.value === currentAnimStyle)?.label ?? currentAnimStyle}
                    </span>
                  )}
                </div>

                {selected && (
                  <div
                    role="radiogroup"
                    aria-label="Animation style"
                    className="grid grid-cols-2 gap-1.5 px-2 pb-3 pt-2"
                  >
                    {ANIM_STYLES.map((st) => {
                      const active = currentAnimStyle === st.value;
                      return (
                        <button
                          key={st.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => handleStyleChange(i, st.value)}
                          style={active ? { borderColor: color, color } : undefined}
                          className={cn(
                            'flex items-center justify-between gap-1 truncate rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors',
                            active
                              ? 'bg-muted'
                              : 'border-border/60 bg-background/40 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
                          )}
                        >
                          <span className="truncate">{st.label}</span>
                          {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Ce panneau ne lit ni l'horloge ni la progression : sans memo, il se
 * re-rendait quand meme a chaque frame en suivant le re-rendu de son parent
 * (whiteboard-editor-step.tsx), lui-meme abonne a currentTime avant que ce
 * dernier ne passe a un selecteur etroit. Garde defensive si une autre
 * source fait re-rendre le parent a l'avenir.
 */
export const AnnotationListPanel = memo(AnnotationListPanelImpl);
