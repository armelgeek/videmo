/**
 * Transitions between scenes.
 *
 * A transition OCCUPIES ITS OWN time slot between scenes. During
 * transitionMs, nothing is drawn — we only fade the last frame of the
 * outgoing scene into the first frame of the incoming one. The next scene
 * starts only once the fade is done. This lengthens the total video duration
 * by transitionMs ms per transition (unless transitionAfter='none').
 *
 * Each transition is a drawing function:
 *   (ctx, outgoing, incoming, t, W, H)  with t from 0 (outgoing) to 1 (incoming)
 */

const TRANSITIONS = {
  /** Hard cut: no blending, incoming from t >= 0.5. */
  cut(ctx, outgoing, incoming, t, W, H) {
    ctx.drawImage(t < 0.5 ? outgoing : incoming, 0, 0);
  },

  /** Crossfade. */
  fade(ctx, outgoing, incoming, t, W, H) {
    ctx.drawImage(outgoing, 0, 0);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.drawImage(incoming, 0, 0);
    ctx.restore();
  },

  /** The incoming slides up and pushes the outgoing upward. */
  slideup(ctx, outgoing, incoming, t, W, H) {
    const dy = Math.round(H * t);
    ctx.drawImage(outgoing, 0, -dy);
    ctx.drawImage(incoming, 0, H - dy);
  },

  slidedown(ctx, outgoing, incoming, t, W, H) {
    const dy = Math.round(H * t);
    ctx.drawImage(outgoing, 0, dy);
    ctx.drawImage(incoming, 0, dy - H);
  },

  slideleft(ctx, outgoing, incoming, t, W, H) {
    const dx = Math.round(W * t);
    ctx.drawImage(outgoing, -dx, 0);
    ctx.drawImage(incoming, W - dx, 0);
  },

  slideright(ctx, outgoing, incoming, t, W, H) {
    const dx = Math.round(W * t);
    ctx.drawImage(outgoing, dx, 0);
    ctx.drawImage(incoming, dx - W, 0);
  },
};

/** Normalized name, falling back to fade if the name is unknown. */
function resoudreTransition(name) {
  if (!name || name === 'none') return null;
  const key = String(name).toLowerCase().replace(/[^a-z]/g, '');
  return TRANSITIONS[key] || TRANSITIONS.fade;
}

/** Available names, for the UI. */
function nomsTransitions() {
  return Object.keys(TRANSITIONS);
}

module.exports = { TRANSITIONS, resoudreTransition, nomsTransitions };
