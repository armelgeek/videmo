import { DRIFT_MAX_MS } from "../hooks/audio-delta";

/**
 * Un temps de narration place sur l'horloge du projet.
 *
 * `startMs` est absolu, et non un decalage depuis le temps precedent : un temps
 * muet laisse alors un trou sans que personne ait a fabriquer du silence.
 */
export interface NarrationPart {
  url: string;
  startMs: number;
  durationMs: number;
}

/**
 * Un tableau vide STABLE, a utiliser comme defaut.
 *
 * Un `[]` ecrit dans une signature est un tableau neuf a chaque rendu : la
 * dependance change sans cesse et l'horloge se reconstruirait sans fin.
 */
export const AUCUNE_PART: readonly NarrationPart[] = Object.freeze([]);

export interface PartAtPosition {
  /** Le rang du morceau dans la liste : il identifie la source a charger. */
  index: number;
  part: NarrationPart;
  /** Ou en est-on DANS ce morceau, en millisecondes. */
  offsetMs: number;
}

/**
 * Quel morceau doit s'entendre a cet instant, et a quelle position.
 *
 * Rend `null` dans les trous — avant le premier temps, entre deux, apres le
 * dernier — ou il ne doit rien se jouer. L'appelant coupe alors le son sans
 * arreter le dessin : l'horloge murale possede la timeline, l'audio la suit.
 *
 * Les morceaux sont supposes ordonnes et sans chevauchement, ce qu'ils sont par
 * construction : ils derivent des memes durees que les annotations.
 */
export function partAt(
  parts: NarrationPart[],
  positionMs: number,
): PartAtPosition | null {
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (positionMs < part.startMs) return null;
    if (positionMs < part.startMs + part.durationMs) {
      return { index, part, offsetMs: positionMs - part.startMs };
    }
  }
  return null;
}

/** La fin du dernier morceau : la duree de la narration entiere. */
export function narrationEndMs(parts: NarrationPart[]): number {
  return parts.reduce(
    (fin, part) => Math.max(fin, part.startMs + part.durationMs),
    0,
  );
}

/**
 * Pose les morceaux bout a bout depuis leurs seules durees.
 *
 * C'est le meme calcul que `deriveTimeline` fait sur les annotations : les deux
 * partent des durees mesurees, donc chaque morceau tombe sur la sienne. Un
 * temps sans voix avance quand meme le curseur — sinon tout ce qui suit
 * parlerait trop tot.
 */
export function scheduleParts(
  temps: { url: string | null; durationMs: number }[],
): NarrationPart[] {
  const parts: NarrationPart[] = [];
  let startMs = 0;

  for (const temp of temps) {
    if (temp.url) {
      parts.push({ url: temp.url, startMs, durationMs: temp.durationMs });
    }
    startMs += temp.durationMs;
  }

  return parts;
}

/**
 * Ce qu'un lecteur doit faire pour se trouver a `positionMs`.
 *
 * Sortie de la decision hors du lecteur : jsdom n'implemente ni `play` ni
 * `load`, donc un lecteur teste directement ne prouverait rien. Ici la regle se
 * verifie seule, et le lecteur ne fait plus qu'executer.
 */
export type NarrationAction =
  /** Rien a faire : le bon morceau joue deja a la bonne position. */
  | { type: "rien" }
  /** Charger ce morceau et s'y placer : on a change de temps. */
  | { type: "charger"; index: number; part: NarrationPart; offsetMs: number }
  /** Meme morceau, mais la position a derive : recaler sans recharger. */
  | { type: "recaler"; index: number; offsetMs: number }
  /** Un trou, ou la fin : se taire. */
  | { type: "taire" };

export interface NarrationState {
  /** Le morceau charge, ou `null` si aucun. */
  index: number | null;
  /** Ou en est ce morceau, selon le lecteur. */
  offsetMs: number;
}

/**
 * La derive toleree avant de recaler.
 *
 * La meme que pour une piste unique, et pour la meme raison : au-dela d'environ
 * 125 ms un decalage son/image se percoit. Un second seuil, plus large, avait
 * ete pose ici sans justification — mesure sur un vrai apercu, il laissait
 * l'element trainer de 160 ms derriere l'horloge, et la fin de chaque
 * enregistrement se trouvait rognee a la bascule.
 *
 * Un recalage s'entend aussi : c'est pourquoi le seuil n'est pas nul.
 */
export const NARRATION_DRIFT_MS = DRIFT_MAX_MS;

export function nextNarrationAction(
  state: NarrationState,
  parts: NarrationPart[],
  positionMs: number,
  driftMs: number = NARRATION_DRIFT_MS,
): NarrationAction {
  const cible = partAt(parts, positionMs);

  if (!cible) return state.index === null ? { type: "rien" } : { type: "taire" };

  if (state.index !== cible.index) {
    return {
      type: "charger",
      index: cible.index,
      part: cible.part,
      offsetMs: cible.offsetMs,
    };
  }

  return Math.abs(state.offsetMs - cible.offsetMs) > driftMs
    ? { type: "recaler", index: cible.index, offsetMs: cible.offsetMs }
    : { type: "rien" };
}
