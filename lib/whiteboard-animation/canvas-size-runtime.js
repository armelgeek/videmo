/**
 * rectContenu in CommonJS, for the server renderer.
 *
 * canvas-size.ts is TypeScript: the worker, a bare Node process, cannot load
 * it. The fit rule is the same on both sides, and canvas-size.test.ts locks it
 * on the TypeScript side.
 */
function rectContenu(canvasW, canvasH, srcW, srcH) {
  if (srcW <= 0 || srcH <= 0) return { x: 0, y: 0, w: canvasW, h: canvasH };
  const scale = Math.min(canvasW / srcW, canvasH / srcH);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  return { x: Math.round((canvasW - w) / 2), y: Math.round((canvasH - h) / 2), w, h };
}

module.exports = { rectContenu };
