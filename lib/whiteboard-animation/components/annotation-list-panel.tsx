'use client';

import { memo, useMemo } from 'react';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { deriveTimeline } from '../timeline/derive-timeline';
import { cn } from '@/lib/utils';
import { DEFAULT_ANIM_STYLE } from '../schema';

/** Couleur de repli du calque d'annotations — meme valeur qu'AnnotationOverlay. */
const DEFAULT_STROKE = '#2563eb';

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
}: {
  className?: string;
  annotations?: import('@/lib/unified-engine/types').Annotation[];
}) {
  const storeAnnotations = useUnifiedEngineStore((s) => s.animation.annotations);
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
    <section className={cn('flex min-h-0 flex-col rounded-xl border border-border bg-card overflow-hidden', className)}>
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold text-foreground">Annotations</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {derived.length}
        </span>
      </header>

      {derived.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">
          No annotations yet. Draw a region on the canvas to add one.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {derived.map((annotation, i) => {
            const selected = selectedIndex === i;
            const color = annotation.style?.strokeColor ?? DEFAULT_STROKE;
            const currentAnimStyle = annotation.animStyle ?? DEFAULT_ANIM_STYLE;

            return (
              <li key={annotation.id ?? i} className="px-1.5 py-0.5">
                <div
                  onClick={() => setSelectedAnnotation(selected ? null : i)}
                  className={cn(
                    'flex w-full items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 transition-colors',
                    selected ? 'bg-muted' : 'hover:bg-muted/50',
                  )}
                >
                  <span
                    aria-hidden
                    className="h-7 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className={cn('block truncate text-xs', selected ? 'font-medium text-foreground' : 'text-foreground/90')}>
                      {annotation.text || `Region ${i + 1}`}
                    </span>
                    <span className="block text-[10px] tabular-nums text-muted-foreground">
                      {formatMs(annotation.reveal.from)} – {formatMs(annotation.reveal.to)}
                    </span>
                  </div>
                  {!selected && currentAnimStyle !== DEFAULT_ANIM_STYLE && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {ANIM_STYLES.find((st) => st.value === currentAnimStyle)?.label ?? currentAnimStyle}
                    </span>
                  )}
                </div>

                {selected && (
                  <div
                    role="radiogroup"
                    aria-label="Animation style"
                    className="grid grid-cols-2 gap-1 px-2 pb-2 pt-1.5"
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
                          className={cn(
                            'truncate rounded-md border px-2 py-1 text-left text-[10px] transition-colors',
                            active
                              ? 'border-primary bg-primary/15 text-foreground'
                              : 'border-transparent bg-background/60 text-muted-foreground hover:border-border hover:text-foreground',
                          )}
                        >
                          {st.label}
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
