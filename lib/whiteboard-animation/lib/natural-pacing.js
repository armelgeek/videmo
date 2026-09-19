/**
 * Calcule la duree naturelle d'un geste de dessin et le temps de maintien (Hold).
 *
 * POURQUOI
 * Dans un montage avec voix-off, une annotation recoit souvent une fenetre
 * temporelle etendue (ex: 4 secondes) pour permettre au narrateur d'expliquer
 * un concept. Si le moteur etire lineairement le trace sur ces 4 secondes pour
 * un simple mot ou une icone, la main avance au ralenti, ce qui n'a rien de
 * naturel.
 *
 * COMMENT (inspire de whiteboard-animator, MIT)
 * La main humaine a une vitesse de deplacement relativement constante.
 * La duree reelle du geste depend donc principalement de la taille et de la
 * complexite de la zone a tracer :
 *
 *   T_naturel (secondes) = 0.28 + sqrt(aire) / 190
 *
 * On adapte cette duree selon le role de l'element :
 *   - Texte / Titre : legerement plus cadencé pour suivre l'ecriture cursive.
 *   - Remplissage : leger bonus pour les aller-retours de brosse.
 *
 * Le trace s'execute sur cette duree naturelle (entre 300 ms et durationMs).
 * Tout le temps restant dans la fenetre audio devient un MAINTIEN (Hold) :
 * le dessin reste net a l'ecran et la main s'efface pour laisser le spectateur
 * se concentrer sur la voix-off.
 *
 * CE MODULE EST PUR
 * Ne depend d'aucun canvas ni du DOM.
 */

'use strict';

/**
 * Calcule la duree naturelle d'un geste de dessin pour une region donnee.
 *
 * @param {Object} region - { width, height } ou { w, h }
 * @param {number} [durationMs=1000] - fenetre temporelle totale allouee a l'annotation
 * @param {Object} [options={}] - options facultatives (role, texte, revealType)
 * @returns {number} duree en millisecondes consacree au geste de dessin
 */
function computeNaturalDuration(region, durationMs = 1000, options = {}) {
  const dureeFenetre = Math.max(100, Number(durationMs) || 1000);

  const w = Number((region && (region.width ?? region.w)) || 100);
  const h = Number((region && (region.height ?? region.h)) || 100);
  const aire = Math.max(w * h, 1);

  // Formule de Kinoslide : 0.28s de base + sqrt(aire) / 190s
  let dureeSec = 0.28 + Math.sqrt(aire) / 190.0;

  const role = (options.role || '').toLowerCase();
  const reveal = (options.revealType || options.reveal || '').toLowerCase();

  // Ajustements selon la nature de l'element
  if (role === 'title' || role === 'text' || role === 'label') {
    const texte = options.text || '';
    if (texte.length > 0) {
      // Bonus pour le nombre de lettres (~40ms par caractere supplementaire)
      dureeSec = Math.max(dureeSec, 0.3 + (texte.length * 0.04));
    }
  } else if (reveal === 'fill') {
    // Un remplissage demande un peu plus d'allers-retours
    dureeSec *= 1.15;
  }

  // Plafond naturel : un geste unique depasse rarement 2.5 secondes
  dureeSec = Math.min(dureeSec, 2.5);

  const dureeNaturelleMs = Math.round(dureeSec * 1000);

  // Plancher minimum de 300 ms pour que l'oeil percoive le geste
  const plancher = Math.min(300, dureeFenetre);

  // La duree de dessin ne peut JAMAIS depasser la fenetre allouee par l'annotation
  return Math.max(plancher, Math.min(dureeNaturelleMs, dureeFenetre));
}

module.exports = {
  computeNaturalDuration,
};
