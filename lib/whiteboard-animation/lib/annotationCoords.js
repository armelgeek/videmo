/**
 * Projection of annotation regions into canvas space.
 *
 * region.{x,y,width,height} are in NATURAL pixels of the layer image (same
 * schema as annotation.json on the Python side). The animation engine works
 * in canvas pixels. This projection is the ONLY definition shared by the
 * frontend (app/index.html) and the backend (server/canvas-renderer.js): both
 * must produce the same render.
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

/** Returns the layer's annotations with regions in canvas coordinates. */
function projectAnnotations(layer) {
  if (!layer || !Array.isArray(layer.annotations)) return [];
  return layer.annotations
    .filter(a => a && a.region)
    .map(a => ({ ...a, region: regionToCanvasRect(layer, a.region) }));
}

/**
 * Natural duration of an annotation timeline, in milliseconds.
 * `speed` is the Reveal slider (40 = 1x): it is the same multiplier that
 * withAnnotationAwareness applies to the clock, so the returned value is the
 * actual preview duration AND the one the video must have.
 */
function timelineDurationMs(annotations, speed = 40) {
  if (!Array.isArray(annotations) || !annotations.length) return 0;
  // Replay the actual schedule: explicit bounds, or chaining by durationMs
  // without audio. Summing durations by hand would ignore the bounds.
  const AnnotationManager = require('./AnnotationManager');
  const m = Object.create(AnnotationManager.prototype);
  m.annotations = annotations;
  const end = m.buildSchedule().reduce((max, s) => Math.max(max, s.endMs), 0);
  const timeScale = Math.max(0.05, (speed || 40) / 40);
  return Math.round(end / timeScale);
}

module.exports = { layerScale, regionToCanvasRect, projectAnnotations, timelineDurationMs };
