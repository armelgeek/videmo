'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import { selectSceneAnnotations } from '@/lib/unified-engine/hooks/selectors';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { deriveTimeline } from '../timeline/derive-timeline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SketchHint } from '@/components/molecules/sketch-hint';
import { Hint } from '@/components/molecules/hint';
import { DEFAULT_ANIM_STYLE, annotationColors } from '../schema';
import { isPremiumStyle } from '../style-tiers';
import { useCreditSummary } from '@/lib/billing/use-credit-summary';

/** Fallback colour of the annotation layer — same value as AnnotationOverlay. */

const ANIM_STYLES = [
  { value: 'chunkjump', label: 'Chunk Jump' },
  { value: 'contour', label: 'Contour' },
  { value: 'gesture', label: 'Gesture' },
  { value: 'illust', label: 'Illustration' },
  { value: 'nervous', label: 'Nervous' },
  { value: 'outlinechunks', label: 'Outline Chunks' },
  { value: 'brushfill', label: 'Brush Fill' },
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
  // Active scene only: the store holds every scene flat, and the indices
  // of this list stay local to the scene.
  const storeAnnotations = useUnifiedEngineStore(selectSceneAnnotations);
  const updateAnnotation = useUnifiedEngineStore((s) => s.updateAnnotation);
  const annotations = annotationsProp ?? storeAnnotations;
  const { summary } = useCreditSummary();
  const premiumLocked = summary ? !summary.features.premiumStyles : false;
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
      // Store not initialised in some isolated environments
    }
  };

  return (
    <section className={cn('flex min-h-0 flex-col overflow-hidden', className)}>

      {derived.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
          <SketchHint direction="left" className="text-lg">
            drag on the image to draw a zone
          </SketchHint>
          <p className="text-xs text-muted-foreground">
            Each zone is drawn by the hand, in order.
          </p>
        </div>
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
                    <Select value={currentAnimStyle} onValueChange={(v) => handleStyleChange(i, v)}>
                      <Hint label="how the hand draws this zone">
                        <SelectTrigger size="sm" aria-label="Animation style" className="h-7 w-36 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                      </Hint>
                      <SelectContent>
                        {ANIM_STYLES.map((st) => {
                          const pro = isPremiumStyle(st.value);
                          return (
                            <SelectItem
                              key={st.value}
                              value={st.value}
                              disabled={pro && premiumLocked && st.value !== currentAnimStyle}
                              className="text-xs"
                            >
                              {st.label}
                              {pro && <span className="ml-1.5 text-[9px] font-bold uppercase text-muted-foreground">pro</span>}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
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
  * This panel reads neither the clock nor the progress: without memo it
  * still re-rendered every frame following its parent's re-render
  * (whiteboard-editor-step.tsx), itself subscribed to currentTime before the
  * latter moved to a narrow selector. Defensive guard in case another
  * source makes the parent re-render in the future.
 */
export const AnnotationListPanel = memo(AnnotationListPanelImpl);
