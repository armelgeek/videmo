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
