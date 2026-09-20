/**
 * Base Animation class for shared animation logic.
 * Works in both browser (canvas context) and Node (simulated canvas via puppeteer).
 * Supports annotation-based timing and region filtering.
 */
const AnnotationManager = require('./AnnotationManager');
const { presenceMapFor, isCacheable } = require('./presence-map');
const { setupRegion, preparerRegion } = require('./region-setup-cache');
const { resolveAnnotationStyle } = require('./resolve-annotation-style');
const { computeNaturalDuration } = require('./natural-pacing');

/** A region's rectangle, clamped to the image; null if empty. */
function regionRect(fullBounds, r) {
  const x = Math.max(fullBounds.x, Math.floor(r.x));
  const y = Math.max(fullBounds.y, Math.floor(r.y));
  const x2 = Math.min(fullBounds.x + fullBounds.w, Math.ceil(r.x + r.width));
  const y2 = Math.min(fullBounds.y + fullBounds.h, Math.ceil(r.y + r.height));
  return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null;
}

class Animation {
  // Default value of the Reveal speed slider: serves as 1x for the multiplier.
  static DEFAULT_SPEED = 40;

  constructor({ state, ctx, hctx, offscreen, callbacks = {} }) {
    this.state = state;
    this.ctx = ctx;
    this.hctx = hctx;
    this.offscreen = offscreen;

    // Callbacks expected to be available in parent context
    this.fillBg = callbacks.fillBg || (() => {});
    this.drawHand = callbacks.drawHand || (() => {});
    // The PUBLISHED progress. Reserved for _reportProgress, the only place
    // that knows the whole timeline.
    this._publishProgress = callbacks.setProgress || (() => {});

    /**
     * The progress styles report on THEIR region: it runs from 0 to 1 per
     * annotation, and does not leave this class.
     *
     * It used to reach the caller's clock in competition with
     * _reportProgress: two values per frame, one local and one global, and the
     * cursor re-swept the clip on every annotation. _reportProgress does
     * overwrite the local value, but the overwrite comes too late — the local
     * one has already been published.
     *
     * Without annotations there is no timeline to report and _reportProgress
     * publishes nothing: the style's progress then becomes the only source
     * again, as before annotation-awareness.
     */
    this.setProgress = (p) => {
      if (!this.annotationManager) this._publishProgress(p);
    };
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
    if (isCacheable(this.offscreen)) return presenceMapFor(this.offscreen, cb);
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

  _getAnnotStyleInstance(styleName) {
    if (!this._annotStyleCache) this._annotStyleCache = {};
    const key = (styleName || '').toLowerCase();
    if (!this._annotStyleCache[key]) {
      const AnimationFactory = require('./index');
      const callbacks = {
        fillBg: (...args) => (this.fillBg ? this.fillBg(...args) : null),
        drawHand: (...args) => (this.drawHand ? this.drawHand(...args) : null),
        setProgress: () => {},
        finishAnim: () => {},
        resScale: (...args) => (this.resScale ? this.resScale(...args) : 1),
        resPointScale: (...args) => (this.resPointScale ? this.resPointScale(...args) : 1),
      };
      const created = AnimationFactory.create(key, {
        state: this.state,
        ctx: this.ctx,
        hctx: this.hctx,
        offscreen: this.offscreen,
        callbacks,
      });
      created._isCustomInstance = true;
      this._annotStyleCache[key] = created;
    }
    const instance = this._annotStyleCache[key];
    instance._isCustomInstance = true;
    instance.ctx = this.ctx;
    instance.hctx = this.hctx;
    instance.offscreen = this.offscreen;
    return instance;
  }

  _resetAnnotStyleCache() {
    if (!this._annotStyleCache) return;
    for (const key in this._annotStyleCache) {
      const inst = this._annotStyleCache[key];
      if (inst) {
        inst._paceCarry = null;
        inst._regionDone = false;
        inst._finished = false;
      }
    }
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
    // Instance lent to an annotation that has its own style: the parent has
    // already advanced the clock, picked the region and set the clip. Replaying
    // all that here would advance time TWICE per frame (the region would end
    // halfway through its window) and could hand control back to the whole image.
    if (this._delegated) {
      const d = this._delegated;
      return animLogic(d.annot, d.bounds, d.paceSpeed, false, d.frames);
    }

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
      this._flushRegion();
      this._flushFull();
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

    // Explicit pause between two annotations: the already revealed drawing
    // stays on screen (repainting the background would erase it), but the
    // HAND disappears — it draws nothing, it has no reason to stay frozen on
    // the last stroke. It reappears at the start of the next annotation.
    if (activeAnnotations.length === 0) {
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this._reportProgress();
      return;
    }

    // Get current annotation and its region
    const active = activeAnnotations[0];
    const activeIdx = active.idx;
    const annot = this.state.annotations[activeIdx];
    const r = annot.region;

    // Custom animation style per annotation support (AI semantic / manual resolution)
    const defaultStyle = (this.state.animStyle || 'chunkjump').toLowerCase();
    const annotStyle = resolveAnnotationStyle(annot, defaultStyle);
    const isCustomStyle = !this._isCustomInstance && !!(annotStyle && annotStyle !== defaultStyle);
    const customInstance = isCustomStyle ? this._getAnnotStyleInstance(annotStyle) : null;


    // Track if annotation changed (only TRUE on first frame of new annotation)
    const annotationChanged = this.state._lastAnnotationIdx !== activeIdx;
    this.state._annotationChanged = annotationChanged;

    if (annotationChanged) {
      this.state._lastAnnotationIdx = activeIdx;
      this._paceCarry = null;
      this._regionDone = false;   // reset per-annotation completion flag
      // A single region entry: it flushes the previous one and rebuilds the
      // canvases. The style that DRAWS (custom if defined) must run its setup()
      // there, otherwise the global style's strokeList would be replayed.
      if (customInstance) {
        customInstance.state._lastAnnotationIdx = activeIdx;
        customInstance._paceCarry = null;
        customInstance._regionDone = false;
      }
      this._enterRegion(cb, r, customInstance || this);
    }

    // If the style already finished drawing this region (signalled via
    // this._regionDone = true), skip animLogic entirely. The flushed pixels are
    // already on ctx; calling fillBg again would erase them.
    if (this._regionDone || (customInstance && customInstance._regionDone)) {
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this._reportProgress();
      return;
    }

    const region = this.state.contentBounds;
    const regionW = region.w;
    const regionH = region.h;

    // Frames this annotation gets. Styles pace themselves against this so the
    // region actually completes within the time it is ACTUALLY given.
    const durationMs = active.durationMs || annot.reveal?.durationMs || 1000;

    // Natural pacing: the hand draws at human speed, then the hand fades out
    // and the drawing stays displayed (Hold) for the remaining time.
    const drawDurationMs = computeNaturalDuration(
      { w: regionW, h: regionH },
      durationMs,
      { role: annot.role, text: annot.object, revealType: annot.revealType },
    );
    const frames = Math.max(1, Math.round(drawDurationMs / effDelta));
    this._frames = frames;

    this._regionElapsed = Math.max(0, this.annotationManager.elapsedMs - active.startMs);
    // paceStep's deadline is the end of the GESTURE, not of the window: the
    // rest of the window is the hold, hand hidden, drawing on screen.
    this._regionDuration = drawDurationMs;

    const rows = Math.max(1, Math.ceil(regionH / 48));
    const paceSpeed = Math.max(0.1, (regionW * rows) / frames);

    const bounds = { x: 0, y: 0, w: regionW, h: regionH };

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(region.x, region.y, regionW, regionH);
    this.ctx.clip();

    try {
      if (customInstance) {
        customInstance.annotationManager = this.annotationManager;
        customInstance._frames = frames;
        customInstance._regionElapsed = this._regionElapsed;
        customInstance._regionDuration = this._regionDuration;
        customInstance._delegated = { annot, bounds, paceSpeed, frames };
        try {
          customInstance.tick(this.state.speed, deltaMs);
        } finally {
          customInstance._delegated = null;
        }
        // The lent style writes _regionDone on itself; the parent must know it
        // so it stops repainting this region's background.
        if (customInstance._regionDone) this._regionDone = true;
      } else {
        animLogic(annot, bounds, paceSpeed, false, frames);
      }
    } finally {
      this.ctx.restore();
    }

    // Styles report progress within their own region, which would hit ~100% on
    // the first annotation. Overwrite with progress along the whole timeline.
    this._reportProgress();
  }

  /**
   * Per-frame step for a style whose work is "advance an index through `total`".
   *
   * In annotation mode the step is sized so the region finishes within its
   * durationMs; in legacy mode `legacyStep` is returned untouched, so the
   * animations.js behaviour is preserved exactly.
   */
  paceStep(total, legacyStep, phases = 1, tag = 0) {
    if (!this._frames) return legacyStep;

    // Each paced list keeps its own cursor: a style may pace several in the
    // same region, and sharing the remainder would make them drift.
    const key = total + ':' + phases + ':' + tag;
    const carry = this._paceCarry || (this._paceCarry = {});
    const st = carry[key] || (carry[key] = { frame: 0, emitted: 0, start: null });
    st.frame++;

    // Share of the window that belongs to this phase: without it phase 1
    // (the stroke) would eat the whole durationMs and the fill phases would
    // not get a single frame.
    const share = 1 / Math.max(1, phases);

    // The phase's deadline within the region window. `tag` is its rank
    // (1-based in styles). A phase that starts LATE must still finish at the
    // end of ITS slot: giving it `share` from where it starts pushes the delay
    // onto the next one, and the last phase overflows the region. That
    // overflow only shows on a clip's last annotation, where _flushRegion
    // stamps it on screen immediately.
    const deadline = Math.min(1, Math.max(1, tag) * share);

    let ratio;
    if (this._regionDuration > 0) {
      const elapsed = this._regionElapsed / this._regionDuration;
      // One frame from the deadline, emit everything left: ticks stop at
      // duration - 1 frame, so the ratio never reaches 1 on its own.
      const tol = this._frames > 0 ? 1 / this._frames : 0;
      if (elapsed >= deadline - tol) {
        const remaining = Math.max(0, total - st.emitted);
        st.emitted = total;
        return remaining;
      }
      // The phase starts where it is first called.
      if (st.start === null) st.start = elapsed;
      ratio = (elapsed - st.start) / Math.max(1e-6, deadline - st.start);
    } else {
      // Outside annotation mode (no clock): fall back to the frame budget.
      ratio = st.frame / Math.max(1, Math.floor(this._frames * share));
    }

    const target = Math.min(total, Math.round(total * Math.min(1, Math.max(0, ratio))));
    // Emit exactly what the cumulative target asks for, even 0. Forcing a
    // minimum of 1 made a short region finish in `total` frames instead of
    // filling its window: holding the frame without advancing IS the right pace.
    const step = Math.max(0, target - st.emitted);
    st.emitted += step;
    return step;
  }

  /**
   * Publishes the clock position on the whole timeline.
   *
   * Must be called on ALL tick paths, including those that return early
   * (pause between two annotations, region already done): otherwise the clock
   * advances without anyone publishing it, and the cursor freezes then jumps
   * to the start of the next annotation.
   */
  _reportProgress() {
    if (!this.annotationManager) return;
    const end = this.annotationManager.endMs();
    if (end > 0) {
      this._publishProgress(Math.min(1, this.annotationManager.elapsedMs / end));
    }
  }

  /**
   * Positions the engine clock without drawing anything.
   *
   * Used for seeking: the image at an annotation boundary is known in advance
   * (background + previous regions stamped), so the caller paints it itself
   * then primes the engine here. The replay then covers a single region
   * instead of starting from scratch.
   *
   * _lastAnnotationIdx is reset to undefined so the next tick sees an
   * annotation change and calls _enterRegion() again.
   */
  primeAt(elapsedMs) {
    if (!this.annotationManager) return;
    this.annotationManager.elapsedMs = Math.max(0, elapsedMs || 0);
    this._finished = false;
    this._regionDone = false;
    this._paceCarry = null;
    this._frames = null;
    this._regionElapsed = 0;
    this._regionDuration = 0;
    this.state._lastAnnotationIdx = undefined;
    this.state._annotationChanged = false;
    this._resetAnnotStyleCache();
  }

  /**
   * Draw the current region's content in full, so no pixel is left behind when
   * we move to the next annotation. No-op outside annotation mode.
   */
  _flushRegion() {
    // Called at the START of every region entry, so the first one has nothing
    // to flush: without this guard the fallback bounds are the whole image and
    // the entire drawing lands on screen before a single stroke is animated.
    const cb = this.state._regionRect;
    if (!cb || cb.w <= 0 || cb.h <= 0) return;

    if (this.state.revealCanvas) {
      this.ctx.drawImage(this.state.revealCanvas, 0, 0);
    }
    if (this.state.ifColorCanvas) {
      this.ctx.drawImage(this.state.ifColorCanvas, 0, 0);
    }
    if (this.state.ofColorCanvas) {
      this.ctx.drawImage(this.state.ofColorCanvas, 0, 0);
    }
    if (this.state.ifOutlineCanvas) {
      this.ctx.drawImage(this.state.ifOutlineCanvas, 0, 0);
    }
    if (this.state.ofOutlineCanvas) {
      this.ctx.drawImage(this.state.ofOutlineCanvas, 0, 0);
    }
    if (this.state.ifInkCanvas) {
      this.ctx.drawImage(this.state.ifInkCanvas, 0, 0);
    }
    if (this.state.edgeCanvas) {
      this.ctx.drawImage(this.state.edgeCanvas, 0, 0);
    }
    if (this.offscreen && this.revelerSource()) {
      this.ctx.drawImage(
        this.offscreen,
        cb.x, cb.y, cb.w, cb.h,
        cb.x, cb.y, cb.w, cb.h
      );
    }
  }

  /**
   * Draw the whole image content, revealing any remaining elements (connectors,
   * decor, titles) once all annotations of the scene have finished.
   */
  _flushFull() {
    if (this.offscreen && this.revelerSource()) {
      this.ctx.drawImage(this.offscreen, 0, 0);
    }
  }

  /**
   * Wraps a multi-phase style's step: if the phase changes during the frame,
   * the next one starts in the same frame. Without it each transition cost an
   * empty frame, and a short window ended before the stroke, the rest stamped
   * all at once at the end. `signature` summarizes the current phase.
   */
  _enchainer(signature, step) {
    return (...args) => {
      const legacy = args[3];
      if (legacy) return step(...args);
      const changed = this.state._annotationChanged;
      try {
        for (let n = 0; n < 8; n++) {
          const before = signature();
          step(...args);
          // The region reset must only apply on the first pass.
          this.state._annotationChanged = false;
          if (this._regionDone || signature() === before) break;
        }
      } finally {
        this.state._annotationChanged = changed;
      }
    };
  }

  /** False for a style whose final render is not the source image (outlines only). */
  revelerSource() {
    return true;
  }

  /**
   * Point contentBounds at one annotation region (clamped to the image) and
   * re-run the style's setup() so its stroke list covers only that region.
   * Per-style state is cleared first so setup() starts from scratch.
   */
  _enterRegion(fullBounds, r, styleOwner = this) {
    // The outgoing region may be a few pixels short of complete: pacing splits
    // a whole number of frames across phases, so the tail can be cut off when
    // durationMs expires. Stamp it fully before moving on - a region is always
    // finished before the next one starts.
    this._flushRegion();

    this.state._fullContentBounds = fullBounds;
    this._paceCarry = null;
    this._regionDone = false;
    this._resetAnnotStyleCache();

    const rect = regionRect(fullBounds, r);

    // Degenerate / off-image region: leave bounds alone, nothing to redraw.
    if (!rect) return;
    const { x, y, w, h } = rect;

    this.state.contentBounds = { x, y, w, h };
    this.state._regionRect = { x, y, w, h };

    // Canvases are rebuilt by setup(); drop them so stale pixels from the
    // previous region are not reused.
    this.state.revealCanvas = null;
    this.state.edgeCanvas = null;

    // Several styles call fillBg(ctx) in setup(); clip so that only this
    // region is repainted and already-revealed annotations survive.
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    try {
      setupRegion(styleOwner);
    } finally {
      this.ctx.restore();
    }
  }

  /**
   * Precomputes the setup of region `index`, so that entering it costs only a
   * copy. Returns false once past the last region.
   */
  prepareRegion(index) {
    const annots = this.state.annotations || [];
    if (index >= annots.length) return false;
    const annot = annots[index];
    if (!annot || !annot.region) return true;
    const defaultStyle = (this.state.animStyle || 'chunkjump').toLowerCase();
    const style = resolveAnnotationStyle(annot, defaultStyle);
    const custom = !!(style && style !== defaultStyle);
    const owner = custom ? this._getAnnotStyleInstance(style) : this;

    const rect = regionRect(this.state._fullContentBounds || this.state.contentBounds, annot.region);
    if (rect) preparerRegion(owner, rect);
    return true;
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
