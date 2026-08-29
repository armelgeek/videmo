/**
 * AnnotationManager — planifie et suit la timeline des annotations.
 *
 * Une annotation repond a UNE question : quand commence-t-elle a se dessiner,
 * et quand est-elle finie ?
 *
 *   reveal: { from: 2950, to: 8500 }
 *
 * Tout le reste se calcule et n'est donc pas stocke : la duree est `to - from`,
 * la pause est l'ecart entre le `to` d'une annotation et le `from` de la
 * suivante (la main y disparait), la fin de la video est le dernier `to`.
 *
 * Ces deux nombres viennent de l'alignement fait en amont : l'IA lit la
 * transcription horodatee de la narration et attribue son segment a chaque
 * region. Le decoupage en phrases est SON materiau de travail, pas notre
 * modele de donnees — le moteur n'a besoin que du resultat.
 *
 * Sans audio, `from`/`to` sont absents : les annotations s'enchainent alors
 * par `durationMs`, comme avant. C'est le seul repli.
 */

/** Bornes explicites d'une annotation, ou null si elle n'en a pas. */
function bornes(annot) {
  const r = (annot && annot.reveal) || {};
  if (r.from == null || r.to == null) {
    if (r.startMs != null) {
      const from = Math.max(0, Number(r.startMs) || 0);
      const dur = Number(r.durationMs) || 1000;
      const to = Math.max(from + 1, from + dur);
      return { from, to };
    }
    return null;
  }
  const from = Math.max(0, Number(r.from) || 0);
  const to = Math.max(from + 1, Number(r.to) || 0);
  return { from, to };
}

class AnnotationManager {
  constructor(state, offscreen) {
    this.state = state;
    this.offscreen = offscreen;
    this.annotations = state.annotations || [];
    // En multi-scene, l'horloge demarre a l'instant GLOBAL de la scene.
    this.elapsedMs = state.departMs || 0;
    this.schedule = this.buildSchedule(state.departMs || 0);
    this.conflits = this.schedule.filter(s => s.conflit);
  }

  /**
   * @param {number} depart  instant de depart sur l'horloge globale, utilise
   *   seulement par le repli sans audio (les bornes explicites sont deja
   *   exprimees sur cette horloge).
   */
  buildSchedule(depart = 0) {
    let curseur = depart;
    return this.annotations.map((annot, idx) => {
      const b = bornes(annot);
      const startMs = b ? b.from : curseur;
      const endMs = b ? b.to : startMs + (((annot.reveal || {}).durationMs) || 1000);
      curseur = endMs;
      return { idx, annot, startMs, endMs, durationMs: endMs - startMs, explicite: !!b };
    }).map((s, i, tout) => {
      // Un chevauchement signifie que le dessin ne tient pas avant la region
      // suivante : le trace devra accelerer. On le signale plutot que de le
      // masquer, c'est une erreur d'alignement en amont.
      const suivante = tout[i + 1];
      return { ...s, conflit: !!(suivante && suivante.startMs < s.endMs) };
    });
  }

  /** Avance l'horloge et renvoie les annotations actives a cet instant. */
  tick(deltaMs) {
    this.elapsedMs += deltaMs;
    const t = this.elapsedMs;
    return this.schedule
      .filter(s => t >= s.startMs && t < s.endMs)
      .map(s => ({ idx: s.idx, annot: s.annot, startMs: s.startMs,
                   durationMs: s.durationMs,
                   progress: (t - s.startMs) / s.durationMs }));
  }

  /** Vrai une fois passe le dernier `to`. */
  isFinished() {
    return this.elapsedMs >= this.endMs();
  }

  /** Fin de la timeline. */
  endMs() {
    return this.schedule.reduce((max, s) => Math.max(max, s.endMs), 0);
  }

  /** Progression (0-1) de l'annotation en cours. */
  getActiveProgress() {
    const active = this.tick(0);
    return active.length ? active[active.length - 1].progress : 0;
  }
}

module.exports = AnnotationManager;
module.exports.bornes = bornes;
