'use client';

import { useMemo } from 'react';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';
import { deriveTimeline } from '../timeline/derive-timeline';
import { cn } from '@/lib/utils';

/** Couleur de repli du calque d'annotations — meme valeur qu'AnnotationOverlay. */
const DEFAULT_STROKE = '#2563eb';

function formatMs(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * La sequence d'annotations, en clair.
 *
 * La timeline montre QUAND chaque region se dessine, le canvas montre OU : il
 * manquait la liste, seul endroit ou on lit les textes d'affilee et ou l'on
 * retrouve une region par son nom plutot qu'en la cherchant sur l'image.
 *
 * Selectionner une ligne selectionne la region sur le canvas — meme
 * `selectedAnnotationIndex` que le calque Konva, qui y pose ses poignees.
 *
 * Les bornes sont DERIVEES a la lecture (deriveTimeline) et non lues dans le
 * store : l'ordre du tableau est la source de verite, les temps absolus s'en
 * deduisent. On n'appelle pas useDerivedAnnotations, qui ecrirait la duree.
 */
export function AnnotationListPanel({ className }: { className?: string }) {
  const annotations = useUnifiedEngineStore((s) => s.animation.annotations);
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

  return (
    <section className={cn("flex min-h-0 flex-col rounded-lg border bg-card", className)}>
      <header className="flex h-8 shrink-0 items-center justify-between border-b px-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Annotations
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
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
            return (
              <li key={annotation.id ?? i}>
                <button
                  type="button"
                  aria-current={selected}
                  onClick={() => setSelectedAnnotation(selected ? null : i)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    selected ? 'bg-muted' : 'hover:bg-muted/50',
                  )}
                >
                  {/* Meme couleur que la region sur le canvas : c'est ce qui
                      relie une ligne a son rectangle sans avoir a le nommer. */}
                  <span
                    aria-hidden
                    className="h-5 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-foreground">
                      {annotation.text || `Region ${i + 1}`}
                    </span>
                    <span className="block text-[10px] tabular-nums text-muted-foreground">
                      {formatMs(annotation.reveal.from)} –{' '}
                      {formatMs(annotation.reveal.to)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
