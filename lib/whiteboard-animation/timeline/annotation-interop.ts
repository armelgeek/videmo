import type { Annotation as EngineAnnotation } from '@/lib/unified-engine/types';
import type { Annotation as StoredAnnotation } from '../schema';

/**
 * The seam between the two Annotation shapes.
 *
 * The engine requires `text` and the absolute `reveal` fields; the saved
 * schema makes them optional and requires `style` instead, plus fields the
 * engine never declares (`metadata`, `narration`). They are close enough to
 * look interchangeable and a cast would compile, which is exactly why these
 * conversions are explicit: the absolute positions are DERIVED, so restoring
 * a project must not trust whatever was written into them last session.
 */

const DEFAULT_STYLE = { strokeColor: '#000000', strokeWidth: 2, opacity: 1 };

export function toEngineAnnotations(
  stored: StoredAnnotation[]
): EngineAnnotation[] {
  return stored.map((a) => ({
    ...a,
    text: a.text ?? '',
    reveal: {
      // deriveTimeline recomputes these from order + duration + gap, so the
      // stored values are placeholders rather than input.
      from: 0,
      to: 0,
      startMs: 0,
      durationMs: a.reveal.durationMs,
      gapBeforeMs: a.reveal.gapBeforeMs,
    },
    style: a.style ?? DEFAULT_STYLE,
  }));
}

export function toStoredAnnotations(
  engine: EngineAnnotation[]
): StoredAnnotation[] {
  return engine.map((a) => ({
    ...a,
    text: a.text,
    reveal: {
      durationMs: a.reveal.durationMs,
      gapBeforeMs: a.reveal.gapBeforeMs,
    },
    style: { ...DEFAULT_STYLE, ...(a.style ?? {}) },
  })) as StoredAnnotation[];
}

/**
 * Cle stable d'une liste d'annotations, insensible a l'ordre des cles.
 *
 * `toStoredAnnotations` reconstruit `style` par un spread (`{...DEFAULT_STYLE,
 * ...a.style}`) : l'objet obtenu porte les MEMES valeurs que celles lues en
 * base, mais dans un ordre de cles fige par DEFAULT_STYLE — souvent different
 * de celui enregistre a l'origine. Un JSON.stringify brut comparait alors deux
 * annotations identiques comme differentes a chaque premiere visite d'une
 * scene, et re-ecrivait le panneau juste pour reordonner ses cles : une
 * ecriture parasite (store + PATCH debounce) a chaque passage de scene, tant
 * que la scene n'etait pas encore "normalisee" en base.
 */
function triCles(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(triCles);
  if (valeur && typeof valeur === 'object') {
    return Object.fromEntries(
      Object.keys(valeur as Record<string, unknown>)
        .sort()
        .map((k) => [k, triCles((valeur as Record<string, unknown>)[k])]),
    );
  }
  return valeur;
}

/**
 * Generique sur les deux formes (stockee, moteur) : la meme comparaison sert
 * a eviter une ecriture parasite vers le stockage ET, en amont, un
 * `setAnnotations` inutile vers le moteur quand le contenu n'a pas change.
 */
export function annotationsEqual<T>(
  a: readonly T[] | undefined,
  b: readonly T[] | undefined
): boolean {
  return JSON.stringify(triCles(a ?? [])) === JSON.stringify(triCles(b ?? []));
}
