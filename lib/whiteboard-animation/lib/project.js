/**
 * Projet multi-scene : plusieurs scenes sur UNE SEULE horloge.
 *
 * L'audio est global a la video. Une scene n'a pas d'horloge propre : elle
 * occupe un segment de l'horloge globale, delimite par les bornes from/to de
 * ses annotations.
 *
 *   project = {
 *     narration: { audioUrl },                      // GLOBAL
 *     scenes: [
 *       { id, canvas:{width,height}, image, annotations:[...],
 *         transition:{ transitionAfter, transitionMs } },
 *       ...
 *     ]
 *   }
 */
const AnnotationManager = require('./AnnotationManager');

/** Duree de la transition APRES une scene (0 si aucune, ou pour la derniere). */
function transitionApres(scene) {
  const t = scene && scene.transition;
  if (!t || !t.transitionAfter || t.transitionAfter === 'none') return 0;
  return Math.max(0, Number(t.transitionMs) || 0);
}

/**
 * Planning complet du projet : chaque scene poursuit l'horloge de la
 * precedente. La transition OCCUPE SON PROPRE CRENEAU entre deux scenes :
 * pendant qu'elle joue, rien ne se dessine, et la scene entrante ne demarre
 * qu'une fois le fondu termine. Elle a donc une duree autonome, exactement
 * comme une annotation.
 *
 * @returns {{scenes: Array, totalMs: number, conflits: Array}}
 */
function buildProjectSchedule(project) {
  const scenes = (project && project.scenes) || [];

  let curseur = 0;
  const plan = scenes.map((scene, idx) => {
    const m = Object.create(AnnotationManager.prototype);
    m.annotations = scene.annotations || [];
    m.elapsedMs = 0;
    const schedule = m.buildSchedule(curseur);

    // MIN et non schedule[0] : les annotations sont dans l'ordre du tableau,
    // pas dans l'ordre du temps. Des qu'une region est deplacee avant une
    // autre (a la souris sur la timeline, ou via Debut/Fin dans l'inspecteur),
    // prendre la premiere du tableau amputait la scene de tout ce qui la
    // precede — duree fausse en preview ET a l'export, qui partagent ce plan.
    const startMs = schedule.length ? Math.min(...schedule.map(s => s.startMs)) : curseur;
    const endMs = schedule.length ? Math.max(...schedule.map(s => s.endMs)) : curseur;
    const transitionMs = idx < scenes.length - 1 ? transitionApres(scene) : 0;

    // La transition consomme son propre temps : la scene suivante attend la
    // fin du fondu avant de tracer son premier trait.
    curseur = endMs + transitionMs;
    return {
      idx, scene, schedule, startMs, endMs, transitionMs,
      transitionAfter: (scene.transition && scene.transition.transitionAfter) || null,
      dureeMs: endMs - startMs,
    };
  });

  return {
    scenes: plan,
    totalMs: plan.length ? Math.max(...plan.map(s => s.endMs)) : 0,
    conflits: plan.flatMap(s => s.schedule.filter(x => x.conflit).map(x => ({ scene: s.idx, ...x }))),
  };
}

/** Duree totale de la video, transitions comprises. */
function projectDurationMs(project) {
  return buildProjectSchedule(project).totalMs;
}

/** Scene affichee a l'instant t (la derniere commencee). */
function sceneA(plan, t) {
  let courante = null;
  for (const s of plan.scenes) if (t >= s.startMs) courante = s;
  return courante;
}

module.exports = { buildProjectSchedule, projectDurationMs, sceneA, transitionApres };
