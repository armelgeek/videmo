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
        <ul className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
          {derived.map((annotation, i) => {
            const selected = selectedIndex === i;
            const playing = playingIndex === i;
            const color = annotationColors(annotation, i).stroke;
            const currentAnimStyle = annotation.animStyle ?? DEFAULT_ANIM_STYLE;
            const seconds = (annotation.reveal.to - annotation.reveal.from) / 1000;

            return (
              <li
                key={annotation.id ?? i}
                className={cn(
                  'rounded-md transition-colors',
                  selected ? 'bg-muted ring-1 ring-border' : playing ? 'bg-muted/60' : 'hover:bg-muted/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => selectAndSeek(i, selected)}
                  aria-pressed={selected}
                  className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums"
                    style={{ color, borderColor: color }}
                  >
                    {i + 1}
                  </span>
                  <span className={cn('min-w-0 flex-1 truncate text-xs', selected ? 'font-medium text-foreground' : 'text-foreground/90')}>
                    {annotation.text || `Region ${i + 1}`}
                  </span>
                  {playing && (
                    <span aria-label="Playing" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  )}
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {seconds.toFixed(1)}s
                  </span>
                </button>

                {selected && (
                  <div className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-2">
                    <span className="text-[11px] text-muted-foreground">
                      {formatMs(annotation.reveal.from)} → {formatMs(annotation.reveal.to)}
                    </span>
                    <label className="mb-0 flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
                      Style
                      <select
                        value={currentAnimStyle}
                        onChange={(e) => handleStyleChange(i, e.target.value)}
                        className="h-7 w-auto rounded-md border border-border bg-card px-2 py-0 text-[11px] font-medium text-foreground"
                      >
                        {ANIM_STYLES.map((st) => (
                          <option key={st.value} value={st.value}>
                            {st.label}
                          </option>
                        ))}
                      </select>
                    </label>
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
