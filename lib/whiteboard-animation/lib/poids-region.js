/**
 * Repartit le temps de dessin entre les regions selon leur poids.
 *
 * POURQUOI
 * Sans narration, chaque annotation recevait 1000 ms, la meme chose pour un
 * titre de trois mots que pour un schema qui occupe la moitie de la planche.
 * Le petit trainait, le grand se dessinait a toute vitesse — et comme le style
 * se cadence sur la fenetre qu'on lui donne (voir Animation.paceStep), c'est la
 * main elle-meme qui accelerait de facon visible d'une region a l'autre.
 *
 * COMMENT
 * Le poids melange deux mesures qui disent chacune une part de la verite :
 *
 *   - le NOMBRE DE CARACTERES de l'annotation, qui suit ce qu'un narrateur
 *     mettrait de temps a lire la region ;
 *   - l'AIRE de la bbox, qui suit ce que la main a reellement a tracer.
 *
 * Aucune des deux seule ne suffit : un long texte sur une petite zone se lit
 * lentement mais se dessine vite, une grande illustration muette est l'inverse.
 * La ponderation 70/30 en faveur du texte vient du moteur de Kinoslide
 * (whiteboard-animator, MIT) ; elle place la lecture devant le trace, parce
 * qu'un spectateur qui a fini de lire decroche avant que le dessin finisse.
 *
 * CE QUE CE MODULE NE FAIT PAS
 * Il ne touche pas aux regions qui ont des bornes explicites. Quand la
 * narration est alignee en amont, c'est l'audio qui fait autorite : le dessin
 * suit la voix, pas une estimation.
 */

'use strict';

/** Part revenant au texte. Le reste va a l'aire. */
const PART_TEXTE = 0.7;

/**
 * Plancher, en fraction de la part moyenne.
 *
 * Une region sans texte ni surface tomberait a zero, donc a une fenetre d'une
 * frame : le style n'aurait pas le temps d'exister et la region clignoterait.
 */
const PLANCHER = 0.15;

/** Le nombre de caracteres qui compte : le texte visible, espaces exclus. */
function caracteres(annot) {
  const texte = (annot && annot.text) || '';
  return texte.replace(/\s+/g, '').length;
}

/** L'aire de la bbox, tolerante aux deux nommages de region rencontres. */
function aire(annot) {
  const r = (annot && annot.region) || {};
  const w = Number(r.width != null ? r.width : r.w) || 0;
  const h = Number(r.height != null ? r.height : r.h) || 0;
  return Math.max(0, w) * Math.max(0, h);
}

const somme = (xs) => xs.reduce((t, x) => t + x, 0);

/**
 * Poids relatifs des annotations, normalises pour sommer a 1.
 *
 * Quand une des deux mesures est absente partout — aucun texte, ou des regions
 * sans dimensions — sa part revient a l'autre plutot que d'etre perdue. Si les
 * deux manquent, le partage redevient uniforme : c'est l'ancien comportement,
 * et c'est le bon, puisque rien ne permet alors de departager les regions.
 *
 * @param {Array} annotations
 * @returns {number[]} un poids par annotation, de meme longueur, total = 1
 */
function poidsRegions(annotations) {
  const n = (annotations || []).length;
  if (n === 0) return [];

  const chars = annotations.map(caracteres);
  const aires = annotations.map(aire);
  const totalChars = somme(chars);
  const totalAire = somme(aires);

  if (totalChars === 0 && totalAire === 0) return annotations.map(() => 1 / n);

  // La part d'une mesure absente bascule sur l'autre : sans ce report, des
  // regions muettes verraient 70% du budget se repartir uniformement et
  // l'aire ne peserait plus que 30%, ce qui aplatit le classement.
  const partTexte = totalChars === 0 ? 0 : totalAire === 0 ? 1 : PART_TEXTE;
  const partAire = 1 - partTexte;

  const bruts = annotations.map((_, i) => {
    const pt = totalChars === 0 ? 0 : chars[i] / totalChars;
    const pa = totalAire === 0 ? 0 : aires[i] / totalAire;
    return partTexte * pt + partAire * pa;
  });

  // Plancher puis renormalisation : relever un poids prend forcement sur les
  // autres, donc le total doit etre refait apres coup pour rester a 1.
  const minimum = PLANCHER / n;
  const releves = bruts.map((p) => Math.max(minimum, p));
  const total = somme(releves);
  return releves.map((p) => p / total);
}

/**
 * Le budget reparti sur les annotations, en millisecondes.
 *
 * Le plancher est pris SUR les autres regions, jamais ajoute au budget : une
 * region relevee doit se payer, sinon la video s'allonge a chaque petite
 * region et le total demande n'est plus tenu. Le prelevement se fait au prorata
 * de la marge de chacune au-dessus du plancher, donc une region deja juste ne
 * paie presque rien et ne repasse pas sous le seuil.
 *
 * Quand le plancher est intenable — plus de regions que le budget n'en peut
 * tenir — c'est lui qui gagne : mieux vaut depasser la duree voulue que rendre
 * des regions invisibles.
 *
 * @param {Array} annotations
 * @param {number} budgetMs  temps total a distribuer
 * @param {number} planchrMs duree minimale d'une region
 * @returns {number[]} une duree par annotation
 */
function repartirDurees(annotations, budgetMs, planchrMs = 200) {
  const poids = poidsRegions(annotations);
  const n = poids.length;
  if (n === 0) return [];
  if (planchrMs * n >= budgetMs) return poids.map(() => planchrMs);

  const durees = poids.map((p) => Math.max(planchrMs, budgetMs * p));
  const marges = durees.map((d) => d - planchrMs);
  const totalMarge = somme(marges);
  const exces = somme(durees) - budgetMs;

  if (exces > 0 && totalMarge > 0) {
    const taux = Math.min(1, exces / totalMarge);
    for (let i = 0; i < n; i++) durees[i] -= marges[i] * taux;
  }

  // L'arrondi se fait en fin de course, le reste allant a la region la plus
  // large : arrondir avant la reprise ferait deriver le total de quelques ms.
  const entiers = durees.map((d) => Math.round(d));
  const reste = budgetMs - somme(entiers);
  if (reste !== 0) {
    const plusLarge = entiers.indexOf(Math.max(...entiers));
    entiers[plusLarge] = Math.max(planchrMs, entiers[plusLarge] + reste);
  }
  return entiers;
}

module.exports = { poidsRegions, repartirDurees, PART_TEXTE };
