/**
 * Ce que le setup() d'un style produit pour une region, calcule une fois.
 *
 * Chaque entree de region rejouait setup() : jusqu'a ~90 ms pour illust ou
 * outlinefill, un gel visible au passage d'une annotation a la suivante, paye
 * a nouveau a chaque replay et a chaque scrub. Pour une feuille donnee, le
 * resultat ne depend que du style, du rectangle et de quelques reglages : il
 * peut etre calcule a l'avance (voir Animation.prepareRegion) et reapplique.
 *
 * Le setup tourne sur un state fantome qui ne porte que ses entrees : tout ce
 * qu'il y ecrit est capture, y compris un compteur remis a 0. Les tick() ne
 * modifient pas les listes produites, qui sont donc partagees ; les canvas
 * qu'ils dessinent sont recrees vides a chaque application.
 */

const { isCacheable } = require('./presence-map');

const CANVAS_DESSINES = new Set([
  'revealCanvas', 'edgeCanvas',
  'ofOutlineCanvas', 'ofColorCanvas',
  'ifOutlineCanvas', 'ifInkCanvas', 'ifColorCanvas',
  'stOutlineCanvas',
]);

const ENTREES = ['canvasW', 'canvasH', 'contentBounds', 'textAnimDir', 'textDrawStyle', 'outlineDetect', 'colorStyle'];

const MAX_PAR_FEUILLE = 64;

const caches = new WeakMap();

function cacheable(owner) {
  return owner.constructor.cacheRegionSetup !== false && isCacheable(owner.offscreen);
}

function cle(owner) {
  const s = owner.state, cb = s.contentBounds;
  return [
    owner.constructor.name, owner.kind || '', owner.mode || '',
    s.canvasW, s.canvasH, cb.x, cb.y, cb.w, cb.h,
    s.textAnimDir || '', s.textDrawStyle || '', s.outlineDetect ? 1 : 0, s.colorStyle || '',
  ].join('|');
}

function calculer(owner) {
  const reel = owner.state;
  const ombre = {};
  for (const k of ENTREES) ombre[k] = reel[k];
  owner.state = ombre;
  try {
    owner.setup();
  } finally {
    owner.state = reel;
  }
  return Object.keys(ombre)
    .filter((k) => !ENTREES.includes(k))
    .map((k) => {
      const v = ombre[k];
      return CANVAS_DESSINES.has(k) && v ? [k, null, v.width, v.height] : [k, v];
    });
}

function obtenir(owner) {
  let parFeuille = caches.get(owner.offscreen);
  if (!parFeuille) caches.set(owner.offscreen, (parFeuille = new Map()));
  const k = cle(owner);
  let champs = parFeuille.get(k);
  if (!champs) {
    champs = calculer(owner);
    parFeuille.set(k, champs);
    if (parFeuille.size > MAX_PAR_FEUILLE) parFeuille.delete(parFeuille.keys().next().value);
  }
  return champs;
}

/** Remplace `owner.setup()` a l'entree d'une region. */
function setupRegion(owner) {
  if (!cacheable(owner)) {
    owner.setup();
    return;
  }
  const state = owner.state;
  for (const [k, v, w, h] of obtenir(owner)) {
    if (w === undefined) {
      state[k] = v;
    } else {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      state[k] = c;
    }
  }
}

/** Calcule d'avance le setup de `owner` sur `rect`, sans toucher a son state. */
function preparerRegion(owner, rect) {
  if (!cacheable(owner)) return;
  const s = owner.state, cb = s.contentBounds;
  s.contentBounds = rect;
  try {
    obtenir(owner);
  } finally {
    s.contentBounds = cb;
  }
}

module.exports = { setupRegion, preparerRegion };
