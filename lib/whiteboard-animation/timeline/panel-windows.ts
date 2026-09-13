/**
 * Ou chaque image tombe sur l'horloge du projet.
 *
 * Les fenetres se deduisaient UNIQUEMENT du dessin : une image sans annotation
 * ne contribuait rien, donc n'avait aucune fenetre. Le calage audio la lisait
 * avec un `?? 0` et retombait a zero — en basculant sur elle, la narration
 * repartait du tout debut au lieu de jouer son passage.
 *
 * Le dessin reste la reference pour SES PROPRES bornes (drawStartMs/
 * drawEndMs) : ce sont ces temps que `deriveTimeline` donne au moteur, et les
 * changer desynchroniserait le trace de lui-meme. Mais la fenetre globale
 * (startMs/endMs), elle, ne peut pas finir avant la voix : sinon l'image
 * suivante prend l'ecran pendant que celle-ci parle encore, le dessin fini
 * mais la phrase non. La voix mesuree comble les trous ET etire la fenetre
 * quand elle depasse le trace ; la duree reglee a l'etape storyboard ne sert
 * qu'en tout dernier recours.
 */

/** Ce que le trace d'une image occupe, tel que deriveTimeline le situe. */
export interface DrawnSpan {
  panelIdx: number;
  drawStartMs: number;
  drawEndMs: number;
}

/** Les durees connues d'une image, hors dessin. */
export interface PanelTiming {
  /** Ce que l'image occupe dans la voix, mesure sur l'enregistrement. */
  audioDurationMs?: number;
  /** La duree reglee a l'etape storyboard, en SECONDES. */
  duration?: number;
}

export interface PanelWindow {
  panelIdx: number;
  startMs: number;
  endMs: number;
  drawStartMs: number;
  drawEndMs: number;
}

/**
 * Ce qu'une image occupe quand son trace ne dit rien : sa voix mesuree, sinon
 * la duree qu'on lui a reglee.
 */
export function secoursMs(panel: PanelTiming): number {
  const voix = panel.audioDurationMs ?? 0;
  if (voix > 0) return voix;
  return Math.max(0, Math.round((panel.duration ?? 0) * 1000));
}

/**
 * Chaque image recoit une fenetre, y compris celles qui ne dessinent rien.
 *
 * Elles s'enchainent : l'image i commence ou l'image i-1 finit, donc le blanc
 * qui precede i lui appartient.
 */
export function panelWindows(
  panels: PanelTiming[],
  drawn: DrawnSpan[],
): PanelWindow[] {
  const parIndex = new Map(drawn.map((span) => [span.panelIdx, span]));
  const windows: PanelWindow[] = [];
  let curseur = 0;

  panels.forEach((panel, panelIdx) => {
    const span = parIndex.get(panelIdx);
    const nextSpan = parIndex.get(panelIdx + 1);
    const startMs = curseur;

    // Le tracé de cette image (s'il existe) a ses propres bornes absolues :
    const drawStartMs = span ? span.drawStartMs : startMs;

    // Avec un tracé, la fenêtre va au moins jusqu'à la FIN du dessin.
    // Si sa voix dépasse ce tracé, la fenêtre s'étend jusqu'à elle.
    const dureeMin = span
      ? Math.max(startMs, span.drawEndMs, startMs + secoursMs(panel))
      : startMs + secoursMs(panel);

    // Si une image suivante commence son dessin plus tard (trou / blanc),
    // la fenêtre s'étend jusqu'au début de ce tracé suivant (nextSpan.drawStartMs).
    // Le trou appartient ainsi au clip sortant (qui peut jouer sa transition vers le fond
    // ou maintenir son image en pause) plutôt que de faire basculer prématurément sur le suivant.
    const endMs = nextSpan
      ? Math.max(dureeMin, nextSpan.drawStartMs)
      : dureeMin;

    windows.push({
      panelIdx,
      startMs,
      endMs,
      // Sans tracé, le dessin se confond avec la fenêtre : le blanc calculé
      // entre deux images reste alors nul plutôt que négatif.
      drawStartMs,
      drawEndMs: span ? span.drawEndMs : endMs,
    });

    curseur = endMs;
  });

  return windows;
}
