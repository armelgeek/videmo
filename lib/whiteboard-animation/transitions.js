/**
 * Transitions entre scenes.
 *
 * Une transition OCCUPE SON PROPRE CRENEAU temporel entre les scenes. Pendant
 * transitionMs, rien ne se dessine — on fond seulement la derniere frame de
 * la scene sortante vers la premiere de l'entrante. La scene suivante ne
 * commence qu'apres le fondu termine. Cela allonge la duree totale de la video
 * de transitionMs ms par transition (sauf si transitionAfter='none').
 *
 * Chaque transition est une fonction de dessin :
 *   (ctx, sortante, entrante, t, W, H)  avec t de 0 (sortante) a 1 (entrante)
 */

const TRANSITIONS = {
  /** Coupe franche : pas de melange, l'entrante des t >= 0.5. */
  cut(ctx, sortante, entrante, t, W, H) {
    ctx.drawImage(t < 0.5 ? sortante : entrante, 0, 0);
  },

  /** Fondu enchaine. */
  fade(ctx, sortante, entrante, t, W, H) {
    ctx.drawImage(sortante, 0, 0);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.drawImage(entrante, 0, 0);
    ctx.restore();
  },

  /** L'entrante monte et pousse la sortante vers le haut. */
  slideup(ctx, sortante, entrante, t, W, H) {
    const dy = Math.round(H * t);
    ctx.drawImage(sortante, 0, -dy);
    ctx.drawImage(entrante, 0, H - dy);
  },

  slidedown(ctx, sortante, entrante, t, W, H) {
    const dy = Math.round(H * t);
    ctx.drawImage(sortante, 0, dy);
    ctx.drawImage(entrante, 0, dy - H);
  },

  slideleft(ctx, sortante, entrante, t, W, H) {
    const dx = Math.round(W * t);
    ctx.drawImage(sortante, -dx, 0);
    ctx.drawImage(entrante, W - dx, 0);
  },

  slideright(ctx, sortante, entrante, t, W, H) {
    const dx = Math.round(W * t);
    ctx.drawImage(sortante, dx, 0);
    ctx.drawImage(entrante, dx - W, 0);
  },
};

/** Nom normalise, avec repli sur le fondu si le nom est inconnu. */
function resoudreTransition(nom) {
  if (!nom || nom === 'none') return null;
  const clef = String(nom).toLowerCase().replace(/[^a-z]/g, '');
  return TRANSITIONS[clef] || TRANSITIONS.fade;
}

/** Noms disponibles, pour l'interface. */
function nomsTransitions() {
  return Object.keys(TRANSITIONS);
}

module.exports = { TRANSITIONS, resoudreTransition, nomsTransitions };
