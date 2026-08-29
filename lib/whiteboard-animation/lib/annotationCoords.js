/**
 * Projection des regions d'annotation vers le repere canvas.
 *
 * region.{x,y,width,height} sont en pixels NATURELS de l'image du layer
 * (meme schema que annotation.json cote Python). Le moteur d'animation, lui,
 * travaille en pixels canvas. Cette projection est la SEULE definition
 * partagee par le frontend (app/index.html) et le backend
 * (server/canvas-renderer.js) : les deux doivent produire le meme rendu.
 */
function layerScale(layer) {
  const img = layer.img || {};
  const nw = img.naturalWidth || img.width || layer.w || 1;
  const nh = img.naturalHeight || img.height || layer.h || 1;
  return { sx: (layer.w || nw) / nw, sy: (layer.h || nh) / nh };
}

function regionToCanvasRect(layer, region) {
  const { sx, sy } = layerScale(layer);
  return {
    x: (layer.x || 0) + region.x * sx,
    y: (layer.y || 0) + region.y * sy,
    width: region.width * sx,
    height: region.height * sy,
  };
}

/** Renvoie les annotations du layer avec des regions en coordonnees canvas. */
function projectAnnotations(layer) {
  if (!layer || !Array.isArray(layer.annotations)) return [];
  return layer.annotations
    .filter(a => a && a.region)
    .map(a => ({ ...a, region: regionToCanvasRect(layer, a.region) }));
}

/**
 * Duree naturelle d'une timeline d'annotations, en millisecondes.
 * `speed` est le curseur Reveal (40 = 1x) : c'est le meme multiplicateur que
 * withAnnotationAwareness applique a l'horloge, donc la valeur renvoyee est la
 * duree reelle de la preview ET celle que la video doit avoir.
 */
function timelineDurationMs(annotations, speed = 40) {
  if (!Array.isArray(annotations) || !annotations.length) return 0;
  // On rejoue le planning reel : bornes explicites, ou enchainement par
  // durationMs sans audio. Sommer les durees a la main ignorerait les bornes.
  const AnnotationManager = require('./AnnotationManager');
  const m = Object.create(AnnotationManager.prototype);
  m.annotations = annotations;
  const end = m.buildSchedule().reduce((max, s) => Math.max(max, s.endMs), 0);
  const timeScale = Math.max(0.05, (speed || 40) / 40);
  return Math.round(end / timeScale);
}

module.exports = { layerScale, regionToCanvasRect, projectAnnotations, timelineDurationMs };
