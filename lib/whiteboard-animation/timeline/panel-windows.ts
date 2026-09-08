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
    const startMs = curseur;

    // Avec un trace, la fenetre va au moins jusqu'a la FIN du dessin, en
    // absolu : le blanc qui precede l'image lui revient. C'est la regle
    // d'origine, et la changer decalerait tout le calage audio des projets
    // existants.
    //
    // Mais si sa voix depasse ce trace — le dessin fini avant la phrase — la
    // fenetre s'etend jusqu'a elle : sans ca, activeClipIndex basculait sur
    // l'image suivante des la derniere touche de pinceau, et son dessin a lui
    // commencait pendant que la voix de la PRECEDENTE parlait encore. Voir
    // whiteboard-editor-step.tsx, l'effet qui suit l'horloge dans le clip
    // suivant : il ne connait que cette fenetre pour decider du changement.
    const endMs = span
      ? Math.max(startMs, span.drawEndMs, startMs + secoursMs(panel))
      : startMs + secoursMs(panel);

    windows.push({
      panelIdx,
      startMs,
      endMs,
      // Sans trace, le dessin se confond avec la fenetre : le blanc calcule
      // entre deux images reste alors nul plutot que negatif.
      drawStartMs: span ? span.drawStartMs : startMs,
      drawEndMs: span ? span.drawEndMs : endMs,
    });

    curseur = endMs;
  });

  return windows;
}
