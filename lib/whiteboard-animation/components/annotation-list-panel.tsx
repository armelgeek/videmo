'use client';

import { memo, useMemo } from 'react';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { deriveTimeline } from '../timeline/derive-timeline';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Couleur de repli du calque d'annotations — meme valeur qu'AnnotationOverlay. */
const DEFAULT_STROKE = '#2563eb';

const ANIM_STYLES = [
  { value: 'global', label: 'Par défaut (Global)' },
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
    const newStyle = styleVal === 'global' ? undefined : styleVal;
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
    <section className={cn('flex min-h-0 flex-col rounded-lg border bg-card', className)}>
      <header className="flex h-8 shrink-0 items-center justify-between border-b px-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Annotations ({derived.length})
        </span>
      </header>

      {derived.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">
          Aucune annotation. Dessinez une région sur le canvas pour en ajouter une.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {derived.map((annotation, i) => {
            const selected = selectedIndex === i;
            const color = annotation.style?.strokeColor ?? DEFAULT_STROKE;
            const currentAnimStyle = annotation.animStyle ?? 'global';

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
                      {annotation.text || `Région ${i + 1}`}
                    </span>
                    <span className="block text-[10px] tabular-nums text-muted-foreground">
                      {formatMs(annotation.reveal.from)} – {formatMs(annotation.reveal.to)}
                    </span>
                  </div>
                  {!selected && currentAnimStyle !== 'global' && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {ANIM_STYLES.find((st) => st.value === currentAnimStyle)?.label ?? currentAnimStyle}
                    </span>
                  )}
                </div>

                {selected && (
                  <div className="px-2 pb-1.5 pt-1">
                    <Select
                      value={currentAnimStyle}
                      onValueChange={(val) => handleStyleChange(i, val)}
                    >
                      <SelectTrigger aria-label="Animation style" className="h-7 w-full text-[11px] px-2 bg-background border-border">
                        <SelectValue placeholder="Par défaut" />
                      </SelectTrigger>
                      <SelectContent>
                        {ANIM_STYLES.map((st) => (
                          <SelectItem key={st.value} value={st.value} className="text-xs">
                            {st.label}
                          </SelectItem>
                        ))}
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
 * Ce panneau ne lit ni l'horloge ni la progression : sans memo, il se
 * re-rendait quand meme a chaque frame en suivant le re-rendu de son parent
 * (whiteboard-editor-step.tsx), lui-meme abonne a currentTime avant que ce
 * dernier ne passe a un selecteur etroit. Garde defensive si une autre
 * source fait re-rendre le parent a l'avenir.
 */
export const AnnotationListPanel = memo(AnnotationListPanelImpl);
