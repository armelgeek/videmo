/**
 * animations-unified.js
 * Unified Whiteboard Animation Engine v2.0
 *
 * Migrated to use lib/AnimationFactory as single source of truth
 * Eliminates 4000+ lines of duplicated animation code
 * Same API as legacy animations.js, powered by lib/
 *
 * Compatible with:
 * - Frontend (app/index.html)
 * - Backend (server/canvas-renderer.js)
 */

(function(window) {
  'use strict';

  console.log('🎨 Loading Unified Animation Engine (v2.0)...');

  // Import factory from lib (in browser via webpack bundle as AnimationLib)
  // In Node.js, this would be: const { AnimationFactory } = require('../lib');
  const AnimationFactory = (window.AnimationLib?.AnimationFactory) ||
                          window.AnimationFactory ||
                          (typeof module !== 'undefined' ? require('../lib').AnimationFactory : null);

  if (!AnimationFactory) {
    throw new Error('AnimationFactory not available. Make sure lib-bundle.js is loaded before animations-unified.js');
  }

  // Reference to global state/ctx (set by caller)
  let state, ctx, hctx, offscreen, fillBg, drawHand, setProgress, finishAnim, resScale, resPointScale;

  // Current animation instance (from factory)
  let currentAnimation = null;

  /**
   * Setup animation for the current style
   * Uses lib/AnimationFactory.create() instead of individual setup functions
   */
  function setupStyle() {
    try {
      const animStyle = state?.animStyle || 'scanner';

      // Collect all callbacks
      const callbacks = {
        fillBg:       fillBg || (() => {}),
        drawHand:     drawHand || (() => {}),
        setProgress:  setProgress || (() => {}),
        finishAnim:   finishAnim || (() => {}),
        resScale:     resScale || (() => 1),
        resPointScale: resPointScale || (() => 1),
      };

      // Create animation via factory (shared lib/, not duplicated)
      currentAnimation = AnimationFactory.create(animStyle, {
        state,
        ctx,
        hctx,
        offscreen,
        callbacks,
      });

      if (currentAnimation) {
        currentAnimation.setup();
      }
    } catch (err) {
      console.error('Animation setup failed:', err.message);
      throw err;
    }
  }

  /**
   * Tick the current animation
   * Delegates to lib/ instance
   */
  function tickStyle(speed, deltaMs) {
    if (currentAnimation) {
      // deltaMs pilote l'horloge des annotations : sans vrai delta, l'animation
      // avance de 16.67ms par frame et va 2x trop vite sur un ecran 120Hz.
      currentAnimation.tick(speed, deltaMs || 16.67);
    }
  }

  /**
   * Annotation slot system (frontend layer rendering)
   * Wraps tick to work with frontend's layer system
   */
  function tickAnnotationSlot(deltaMs) {
    tickStyle(state?.speed || 40, deltaMs);
  }

  function setupAnnotationSlot() {
    setupStyle();
  }

  // Legacy helpers (kept for backward compatibility if needed)
  function buildPresenceMap() {
    // Delegate to Animation base class method if available
    // This prevents code duplication
    if (currentAnimation && currentAnimation.buildPresenceMap) {
      return currentAnimation.buildPresenceMap();
    }
    // Fallback to inline if needed
    const cb = state.contentBounds;
    const W = cb.w, H = cb.h;
    const d = offscreen.getContext('2d', { willReadFrequently: true }).getImageData(cb.x, cb.y, W, H).data;
    const map = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y*W+x)*4;
      const a = d[i+3];
      if (a > 20 && (a < 250 || d[i] < 240 || d[i+1] < 240 || d[i+2] < 240))
        map[y*W+x] = 1;
    }
    return map;
  }

  // Export unified engine
  window.AnimationEngine = {
    setupStyle,
    tickStyle,
    setupAnnotationSlot,
    tickAnnotationSlot,
    buildPresenceMap,

    // Expose factory for advanced usage
    _factory: AnimationFactory,
    _currentAnimation: () => currentAnimation,

    // Set globals (called by app/index.html)
    _setGlobals(s, c, h, o, fb, dh, sp, fa, rs, rps) {
      state = s;
      ctx = c;
      hctx = h;
      offscreen = o;
      fillBg = fb;
      drawHand = dh;
      setProgress = sp;
      finishAnim = fa;
      resScale = rs;
      resPointScale = rps;
    },

    // Slot system (for frontend parallel layer rendering)
    _SLOT_KEYS: [],
    _slotIn: (slot) => {
      if (slot && slot.state) state = slot.state;
    },
    _slotOut: (slot) => {
      if (slot) slot.state = state;
    },
    _tickSlot: (deltaMs) => {
      if (currentAnimation) currentAnimation.tick(state?.speed || 40, deltaMs || 16.67);
    },
    _tickAllSlots: (deltaMs) => {
      // Unified version: single animation, just tick once.
      // deltaMs doit remonter jusqu'ici : c'est la branche reellement empruntee
      // quand des slots sont actifs, et sans lui l'horloge des annotations
      // avance de 16.67ms par frame (2x trop vite en 120Hz).
      if (currentAnimation) currentAnimation.tick(state?.speed || 40, deltaMs || 16.67);
    },

    // Annotation reveal stubs (for preview system)
    annotationDrawReveal: () => {},
    annotationDrawDetectionBadge: () => {},
  };

  console.log('✓ Unified Animation Engine loaded');
  console.log('  • All 22 animations via lib/AnimationFactory');
  console.log('  • Zero duplication: frontend + backend identical');
  console.log('  • Source of truth: lib/');

})(typeof window !== 'undefined' ? window : global);
