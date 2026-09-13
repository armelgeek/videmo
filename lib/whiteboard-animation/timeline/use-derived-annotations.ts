"use client";

import { useEffect, useMemo } from "react";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { selectSceneAnnotations } from "@/lib/unified-engine/hooks/selectors";
import { deriveTimeline } from "./derive-timeline";
import { sansAttenteInitiale } from "./sans-attente-initiale";

export interface UseDerivedAnnotationsOptions {
  /**
   * Whether the annotation schedule sets the timeline duration. False when a
   * narration track owns it: the video lasts as long as its audio, and the
   * schedule is only the drawing plan. Both writing unconditionally would let
   * them fight over the store.
   */
  governsDuration?: boolean;
}

/**
 * The render path's single entry point to annotation timing.
 *
 * Whoever writes to the store only sets order, durations and gaps; the absolute
 * positions are recomputed here, so the renderer can never read a stale or
 * hand-edited startMs.
 */
export function useDerivedAnnotations(
  { governsDuration = true }: UseDerivedAnnotationsOptions = {}
) {
  // La scene active seulement : le store porte toutes les scenes a plat.
  const annotations = useUnifiedEngineStore(selectSceneAnnotations);
  const storeDuration = useUnifiedEngineStore((s) => s.timeline.duration);
  const setDuration = useUnifiedEngineStore((s) => s.setDuration);

  // L'attente devant la premiere annotation est retiree ICI, a l'entree unique
  // du chemin de rendu : elle mesure la distance depuis le clip precedent sur
  // l'horloge globale, et n'a pas de sens a l'interieur du clip. La garder
  // faisait attendre le moteur sur un fond vide, puis debordait la fenetre du
  // clip d'autant. Voir sansAttenteInitiale.
  //
  // Les frontieres de panneaux, elles, derivent la sequence GLOBALE sans passer
  // par ici : leurs intervalles entre clips restent intacts.
  const derived = useMemo(
    () => deriveTimeline(sansAttenteInitiale(annotations)),
    [annotations],
  );

  useEffect(() => {
    if (!governsDuration) return;
    if (annotations.length === 0) return;
    if (derived.totalDurationMs === storeDuration) return;
    setDuration(derived.totalDurationMs);
  }, [
    governsDuration,
    annotations.length,
    derived.totalDurationMs,
    storeDuration,
    setDuration,
  ]);

  return derived;
}
