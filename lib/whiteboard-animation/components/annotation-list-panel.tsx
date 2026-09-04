'use client';

import { useMemo } from 'react';
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

export function AnnotationListPanel({
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
        <span className="text-[10px] text-muted-foreground">
          Style individuel
        </span>
      </header>

      {derived.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">
          Aucune annotation. Dessinez une région sur le canvas pour en ajouter une.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto py-1 divide-y divide-border/30">
          {derived.map((annotation, i) => {
            const selected = selectedIndex === i;
            const color = annotation.style?.strokeColor ?? DEFAULT_STROKE;
            const currentAnimStyle = annotation.animStyle ?? 'global';

            return (
              <li key={annotation.id ?? i} className="p-2 space-y-1.5 hover:bg-muted/30">
                <div
                  onClick={() => setSelectedAnnotation(selected ? null : i)}
                  className={cn(
                    'flex w-full items-center gap-2 cursor-pointer rounded px-1.5 py-1 transition-colors',
                    selected ? 'bg-muted font-medium' : 'hover:bg-muted/50',
                  )}
                >
                  <span
                    aria-hidden
                    className="h-5 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-foreground">
                      {annotation.text || `Région ${i + 1}`}
                    </span>
                    <span className="block text-[10px] tabular-nums text-muted-foreground">
                      {formatMs(annotation.reveal.from)} – {formatMs(annotation.reveal.to)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-3 pt-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                    Style :
                  </span>
                  <Select
                    value={currentAnimStyle}
                    onValueChange={(val) => handleStyleChange(i, val)}
                  >
                    <SelectTrigger className="h-6 w-full text-[11px] px-2 bg-background border-border">
                      <SelectValue placeholder="Par défaut" />
                    </SelectTrigger>
                    <SelectContent>
                      {ANIM_STYLES.map((s) => (
                        <SelectItem key={s.value} value={s.value} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
