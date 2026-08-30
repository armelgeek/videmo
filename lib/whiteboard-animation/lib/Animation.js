/**
 * Base Animation class for shared animation logic.
 * Works in both browser (canvas context) and Node (simulated canvas via puppeteer).
 * Supports annotation-based timing and region filtering.
 */
const AnnotationManager = require('./AnnotationManager');

class Animation {
  // Valeur par defaut du curseur Reveal speed : sert de 1x pour le multiplicateur.
  static DEFAULT_SPEED = 40;

  constructor({ state, ctx, hctx, offscreen, callbacks = {} }) {
    this.state = state;
    this.ctx = ctx;
    this.hctx = hctx;
    this.offscreen = offscreen;

    // Callbacks expected to be available in parent context
    this.fillBg = callbacks.fillBg || (() => {});
    this.drawHand = callbacks.drawHand || (() => {});
    this.setProgress = callbacks.setProgress || (() => {});
    this.finishAnim = callbacks.finishAnim || (() => {});
    this.resScale = callbacks.resScale || (() => 1);
    this.resPointScale = callbacks.resPointScale || (() => 1);

    // A previous run may have left contentBounds pointing at a region.
    if (state._fullContentBounds) {
      state.contentBounds = state._fullContentBounds;
      state._fullContentBounds = null;
    }
    state._lastAnnotationIdx = undefined;
    state._annotationChanged = false;
    state._regionRect = null;

    // Annotation-aware support
    if (state.annotations && state.annotations.length > 0) {
      this.annotationManager = new AnnotationManager(state, offscreen);
    }
  }

  setup() {
    // Override in subclasses
  }

  tick(speed) {
    // Override in subclasses
  }

  buildPresenceMap() {
    const cb = this.state.contentBounds;
    const W = cb.w, H = cb.h;
    const imgData = this.offscreen.getContext('2d', { willReadFrequently: true })
      .getImageData(cb.x, cb.y, W, H);
    const d = imgData.data;
    const map = new Uint8Array(W * H);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const a = d[i + 3];
        if (a > 20 && (a < 250 || d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240)) {
          map[y * W + x] = 1;
        }
      }
    }
    return map;
  }

  ensureRevealCanvas() {
    if (!this.state.revealCanvas) {
      this.state.revealCanvas = document.createElement('canvas');
      this.state.revealCanvas.width = this.state.canvasW;
      this.state.revealCanvas.height = this.state.canvasH;
      this.state.revealCanvas.getContext('2d').clearRect(0, 0, this.state.canvasW, this.state.canvasH);
    }
  }

  /**
   * Get currently active annotations (updates annotation manager time)
   */
  getActiveAnnotations(deltaMs = 16.67) {
    if (!this.annotationManager) return [];
    this.annotationManager.elapsedMs += deltaMs;
    return this.annotationManager.tick(0);
  }

  /**
   * ABSTRACTION: Wraps animation logic to be annotation-aware
   *
   * Usage in subclass:
   *   tick(speed, deltaMs) {
   *     return this.withAnnotationAwareness(deltaMs, (annot, bounds, paceSpeed) => {
   *       // Your animation logic here, using:
   *       // - annot: current annotation object
   *       // - bounds: { x, y, w, h } region bounds in local coords
   *       // - paceSpeed: calculated pixels/frame to fit durationMs
   *       // - legacy: boolean, true if no annotations
   *     });
   *   }
   */
  withAnnotationAwareness(deltaMs, animLogic) {
    // The full-image bounds, kept aside because annotation mode swaps
    // contentBounds for the active region (see _enterRegion).
    const cb = this.state._fullContentBounds || this.state.contentBounds;

    // ponytail: no content (layer removed / setup never completed) -> nothing to animate.
    // Guards every style at once instead of null-checking canvases in each tick.
    if (!cb || cb.w <= 0 || cb.h <= 0) return;

    // No annotations? Use legacy mode
    if (!this.annotationManager) {
      this._frames = null;
      return animLogic(null, { x: 0, y: 0, w: cb.w, h: cb.h }, null, true);
    }

    // Reveal speed = global timeline multiplier. The slider's default (40)
    // means 1x, i.e. the annotation's durationMs is honoured exactly and the
    // render matches the Python engine. Scaling the CLOCK (not just the step)
    // is what makes region switches move with it too.
    const timeScale = Math.max(0.05, (this.state.speed || Animation.DEFAULT_SPEED) / Animation.DEFAULT_SPEED);
    const effDelta = (deltaMs || 16.67) * timeScale;

    // Get active annotations
    const activeAnnotations = this.getActiveAnnotations(effDelta);

    // Past the last annotation's end -> the whole animation is done.
    // ponytail: styles only call finishAnim() in legacy mode, so without this
    // the rAF loop would never stop (the "scanne à l'infini" bug).
    if (this.annotationManager.isFinished()) {
      // Only end once: ticking past the end must not re-fire finishAnim.
      if (this._finished) return;
      this._finished = true;
      // Le dessin doit etre COMPLET a la fin : on tamponne toute l'image, pas
      // seulement la derniere region. Sans cela, le contenu qu'aucune region
      // ne couvre n'est jamais trace (0,03% sur la scene de reference) et la
      // video exportee perd des morceaux de l'image de l'utilisateur.
      this.state._regionRect = { x: cb.x, y: cb.y, w: cb.w, h: cb.h };
      this._flushRegion();
      this.state._regionRect = null;
      // Hand the full-image bounds back before ending.
      if (this.state._fullContentBounds) {
        this.state.contentBounds = this.state._fullContentBounds;
        this.state._fullContentBounds = null;
      }
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.state._annIdx = (this.state.annotations ? this.state.annotations.length : 0);
      this.finishAnim();
      return;
    }

    // Pause explicite entre deux annotations : le dessin deja revele reste a
    // l'ecran (repeindre le fond l'effacerait), mais la MAIN disparait — elle
    // ne dessine rien, elle n'a pas a rester figee sur le dernier trait. Elle
    // reapparait au debut de l'annotation suivante.
    if (activeAnnotations.length === 0) {
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      return;
    }

    // Get current annotation and its region
    const actif = activeAnnotations[0];
    const activeIdx = actif.idx;
    const annot = this.state.annotations[activeIdx];
    const r = annot.region;

    // Track if annotation changed (only TRUE on first frame of new annotation)
    const annotationChanged = this.state._lastAnnotationIdx !== activeIdx;
    this.state._annotationChanged = annotationChanged;

    if (annotationChanged) {
      this.state._lastAnnotationIdx = activeIdx;
      this._paceCarry = null;
      // Rebuild the style's stroke list for THIS region only.
      // ponytail: setup() derives its presence map and waypoints from
      // contentBounds, so pointing it at the region is what makes the reveal
      // genuinely region-by-region. Clipping a whole-image stroke list instead
      // leaves the hand wandering off-region and ignores durationMs.
      this._enterRegion(cb, r);
    }

    const region = this.state.contentBounds;
    const regionW = region.w;
    const regionH = region.h;

    // Frames this annotation gets. Styles pace themselves against this so the
    // region actually completes dans le temps qui lui est REELLEMENT accorde.
    // ponytail: the old `area/durationMs*0.016` collapsed to 1px/frame on real
    // regions, so nothing finished in time and each region visibly jumped.
    //
    // La duree vient du PLANNING (to - from), pas du durationMs ecrit par
    // l'auteur : depuis le passage aux bornes from/to les deux divergent, et se
    // caler sur la valeur ecrite faisait tracer trop lentement quand la fenetre
    // reelle etait plus courte. La region n'etait alors dessinee qu'aux deux
    // tiers, puis _flushRegion la tamponnait d'un coup — le "pop" visible.
    const durationMs = actif.durationMs || annot.reveal?.durationMs || 1000;
    const frames = Math.max(1, Math.round(durationMs / effDelta));
    this._frames = frames;

    // Horizontal travel per frame for band/scan styles: the hand sweeps the
    // region's width once per band row.
    const rows = Math.max(1, Math.ceil(regionH / 48));
    const paceSpeed = Math.max(1, Math.ceil((regionW * rows) / frames));

    // Region-local coordinates: setup() already re-based on the region.
    const bounds = { x: 0, y: 0, w: regionW, h: regionH };

    // Confine drawing to this annotation's region with a clip.
    // ponytail: a rect clip replaces the old per-frame getImageData mask —
    // that scanned ~1.3M pixels every tick (froze the renderer) AND erased
    // annotations already revealed. Regions are rectangles, so a clip is exact.
    // Clip to exactly the rect _flushRegion restores. A padded clip would let
    // this region's fillBg erase a 22px band of a neighbouring region that the
    // (unpadded) flush never repaints - which is how region 1 lost pixels to
    // the regions drawn after it.
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(region.x, region.y, regionW, regionH);
    this.ctx.clip();

    try {
      animLogic(annot, bounds, paceSpeed, false, frames);
    } finally {
      this.ctx.restore();
    }

    // Styles report progress within their own region, which would hit ~100% on
    // the first annotation. Overwrite with progress along the whole timeline.
    const end = this.annotationManager.endMs();
    if (end > 0) {
      this.setProgress(Math.min(1, this.annotationManager.elapsedMs / end));
    }
  }

  /**
   * Per-frame step for a style whose work is "advance an index through `total`".
   *
   * In annotation mode the step is sized so the region finishes within its
   * durationMs; in legacy mode `legacyStep` is returned untouched, so the
   * animations.js behaviour is preserved exactly.
   */
  paceStep(total, legacyStep, phases = 1) {
    if (!this._frames) return legacyStep;
    // Split the region's frame budget across the style's phases, otherwise
    // phase 1 (the stroke) eats the whole durationMs and the fill/colour
    // phases never get a single frame.
    const budget = Math.max(1, Math.floor(this._frames / Math.max(1, phases)));
    const exact = total / budget;

    // Below one point per frame there is nothing to spread: the region has
    // fewer points than frames and finishes early no matter what.
    if (exact < 1) return 1;

    // Track the cumulative target rather than rounding each frame up. Rounding
    // up (ceil) made each region consume only 75-96% of its frame budget, so
    // the drawing finished before durationMs and froze until the next
    // annotation. Keyed per (total, phases): a style may pace several
    // different lists within one region.
    const key = total + ':' + phases;
    const carry = this._paceCarry || (this._paceCarry = {});
    const st = carry[key] || (carry[key] = { frame: 0, emitted: 0 });
    st.frame++;
    const target = Math.min(total, Math.round(exact * st.frame));
    const step = Math.max(1, target - st.emitted);
    st.emitted += step;
    return step;
  }

  /**
   * Draw the current region's content in full, so no pixel is left behind when
   * we move to the next annotation. No-op outside annotation mode.
   */
  _flushRegion() {
    const rect = this.state._regionRect;
    if (!rect) return;
    this.ctx.drawImage(this.offscreen,
      rect.x, rect.y, rect.w, rect.h,
      rect.x, rect.y, rect.w, rect.h);
  }

  /**
   * Point contentBounds at one annotation region (clamped to the image) and
   * re-run the style's setup() so its stroke list covers only that region.
   * Per-style state is cleared first so setup() starts from scratch.
   */
  _enterRegion(fullBounds, r) {
    // The outgoing region may be a few pixels short of complete: pacing splits
    // a whole number of frames across phases, so the tail can be cut off when
    // durationMs expires. Stamp it fully before moving on - a region is always
    // finished before the next one starts.
    this._flushRegion();

    this.state._fullContentBounds = fullBounds;

    const x = Math.max(fullBounds.x, Math.floor(r.x));
    const y = Math.max(fullBounds.y, Math.floor(r.y));
    const x2 = Math.min(fullBounds.x + fullBounds.w, Math.ceil(r.x + r.width));
    const y2 = Math.min(fullBounds.y + fullBounds.h, Math.ceil(r.y + r.height));

    // Degenerate / off-image region: leave bounds alone, nothing to redraw.
    if (x2 <= x || y2 <= y) return;

    this.state.contentBounds = { x, y, w: x2 - x, h: y2 - y };
    this.state._regionRect = { x, y, w: x2 - x, h: y2 - y };

    // Canvases are rebuilt by setup(); drop them so stale pixels from the
    // previous region are not reused.
    this.state.revealCanvas = null;
    this.state.edgeCanvas = null;

    // Several styles call fillBg(ctx) in setup(); clip so that only this
    // region is repainted and already-revealed annotations survive.
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, x2 - x, y2 - y);
    this.ctx.clip();
    try {
      this.setup();
    } finally {
      this.ctx.restore();
    }
  }

  // Helper: build edge map from presence map
  buildEdgeMap(presenceMap) {
    const cb = this.state.contentBounds;
    const W = cb.w, H = cb.h;
    const edgeMap = new Uint8Array(W * H);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!presenceMap[y * W + x]) continue;
        const isBoundary =
          (x === 0 || !presenceMap[y * W + (x - 1)]) ||
          (x === W - 1 || !presenceMap[y * W + (x + 1)]) ||
          (y === 0 || !presenceMap[(y - 1) * W + x]) ||
          (y === H - 1 || !presenceMap[(y + 1) * W + x]);
        if (isBoundary) edgeMap[y * W + x] = 1;
      }
    }
    return edgeMap;
  }

  // Helper: collect edge pixels in traversal order
  collectEdgePixels(edgeMap, order = 'default') {
    const cb = this.state.contentBounds;
    const W = cb.w, H = cb.h;
    const edgePts = [];

    if (order === 'default') {
      // top→right→bottom→left
      for (let x = 0; x < W; x++)
        for (let y = 0; y < H; y++)
          if (edgeMap[y * W + x]) { edgePts.push({ x: cb.x + x, y: cb.y + y }); break; }
      for (let y = 0; y < H; y++)
        for (let x = W - 1; x >= 0; x--)
          if (edgeMap[y * W + x]) { edgePts.push({ x: cb.x + x, y: cb.y + y }); break; }
      for (let x = W - 1; x >= 0; x--)
        for (let y = H - 1; y >= 0; y--)
          if (edgeMap[y * W + x]) { edgePts.push({ x: cb.x + x, y: cb.y + y }); break; }
      for (let y = H - 1; y >= 0; y--)
        for (let x = 0; x < W; x++)
          if (edgeMap[y * W + x]) { edgePts.push({ x: cb.x + x, y: cb.y + y }); break; }
    }
    return edgePts;
  }
}

module.exports = Animation;
