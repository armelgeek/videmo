/**
 * Ce qu'un seek doit faire pour atteindre `targetMs` sans tout rejouer.
 *
 * L'image a la FRONTIERE d'une annotation est connue en forme close : le moteur
 * tamponne chaque region en entier avant de passer a la suivante (_flushRegion),
 * donc cette image est le fond plus les regions precedentes estampillees depuis
 * l'artwork source. L'appelant la peint, puis n'anime que la region courante —
 * le rejeu est borne par la duree d'UNE region au lieu de croitre avec la
 * position cherchee.
 */

export interface SeekScheduleEntry {
  startMs: number;
  endMs: number;
}

export interface SeekPlan {
  /** Index des regions a estampiller entierement avant de rejouer. */
  stampRegions: number[];
  /** Estampiller l'artwork entier : on cherche au-dela de la derniere region. */
  stampAll: boolean;
  /** Position ou poser l'horloge du moteur sans rien dessiner. */
  primeAt: number;
  /** Bornes du rejoue anime, ou null s'il n'y a rien a animer. */
  advance: { from: number; to: number } | null;
}

export function planSeek(
  schedule: SeekScheduleEntry[] | null | undefined,
  targetMs: number,
): SeekPlan {
  const cible = Math.max(0, targetMs);

  // Sans annotations le style s'anime d'un bloc : aucune frontiere ou
  // s'accrocher, seul un rejeu depuis le debut donne la bonne image.
  if (!schedule || schedule.length === 0) {
    return { stampRegions: [], stampAll: false, primeAt: 0, advance: { from: 0, to: cible } };
  }

  const idx = schedule.findIndex((s) => cible < s.endMs);

  // Au-dela de la derniere region : le moteur estampille toute l'image en
  // terminant, y compris ce qu'aucune region ne couvre.
  if (idx === -1) {
    return { stampRegions: [], stampAll: true, primeAt: cible, advance: null };
  }

  const stampRegions = Array.from({ length: idx }, (_, i) => i);
  const entry = schedule[idx];

  // Dans une pause entre deux annotations : rien de plus a tracer, et la main
  // n'a pas a rester figee sur le dernier trait.
  if (cible < entry.startMs) {
    return { stampRegions, stampAll: false, primeAt: cible, advance: null };
  }

  return {
    stampRegions,
    stampAll: false,
    primeAt: entry.startMs,
    advance: { from: entry.startMs, to: cible },
  };
}
