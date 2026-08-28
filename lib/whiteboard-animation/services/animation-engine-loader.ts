/**
 * Animation Engine Loader
 * Loads and initializes the real sketchpilot animation system
 */

interface AnimationEngineGlobal {
  AnimationLib?: {
    AnimationFactory?: any;
  };
  AnimationFactory?: any;
  AnimationEngine?: {
    _setGlobals: (state: any, ctx: CanvasRenderingContext2D, hctx: CanvasRenderingContext2D, selctx: CanvasRenderingContext2D, offscreen: CanvasRenderingContext2D) => void;
    setupAnnotationSlot: () => void;
    tickAnnotationSlot: (deltaMs: number) => void;
  };
}

declare global {
  interface Window extends AnimationEngineGlobal {}
}

/**
 * Load animation engine scripts from public folder
 * Must load lib-bundle.js before animations-unified.js
 */
export const loadAnimationEngine = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof window !== 'undefined' && window.AnimationEngine) {
      resolve();
      return;
    }

    try {
      // Load lib-bundle.js first (exposes AnimationLib globally)
      const libScript = document.createElement('script');
      libScript.src = '/lib-bundle.js';
      libScript.async = false;
      libScript.onload = () => {
        // Verify AnimationLib loaded
        if (typeof window !== 'undefined' && window.AnimationLib?.AnimationFactory) {
          // Now load animations-unified.js (uses AnimationLib from lib-bundle)
          const animScript = document.createElement('script');
          animScript.src = '/animations-unified.js';
          animScript.async = false;
          animScript.onload = () => {
            // Verify AnimationEngine is available
            if (typeof window !== 'undefined' && window.AnimationEngine) {
              console.log('✅ Animation engine loaded successfully');
              resolve();
            } else {
              reject(new Error('AnimationEngine not available after loading scripts'));
            }
          };
          animScript.onerror = () => {
            reject(new Error('Failed to load animations-unified.js'));
          };
          document.head.appendChild(animScript);
        } else {
          reject(new Error('AnimationLib not available after loading lib-bundle.js'));
        }
      };
      libScript.onerror = () => {
        reject(new Error('Failed to load lib-bundle.js'));
      };
      document.head.appendChild(libScript);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Initialize animation engine with canvas contexts
 */
export const initializeAnimationEngine = (
  state: any,
  ctx: CanvasRenderingContext2D,
  hctx: CanvasRenderingContext2D,
  selctx: CanvasRenderingContext2D,
  offscreen: CanvasRenderingContext2D
): void => {
  if (typeof window === 'undefined' || !window.AnimationEngine) {
    throw new Error('Animation engine not loaded. Call loadAnimationEngine() first.');
  }

  try {
    window.AnimationEngine._setGlobals(state, ctx, hctx, selctx, offscreen);
    console.log('✅ Animation engine initialized with canvases');
  } catch (error) {
    console.error('Failed to initialize animation engine:', error);
    throw error;
  }
};

/**
 * Setup animation for a specific style
 */
export const setupAnimation = (styleName: string): void => {
  if (typeof window === 'undefined' || !window.AnimationEngine) {
    throw new Error('Animation engine not initialized');
  }

  try {
    window.AnimationEngine.setupAnnotationSlot();
    console.log(`✅ Animation setup for style: ${styleName}`);
  } catch (error) {
    console.error(`Failed to setup animation style ${styleName}:`, error);
    throw error;
  }
};

/**
 * Tick the animation engine
 */
export const tickAnimation = (deltaMs: number): void => {
  if (typeof window === 'undefined' || !window.AnimationEngine) {
    return; // Silently fail if engine not loaded
  }

  try {
    window.AnimationEngine.tickAnnotationSlot(deltaMs);
  } catch (error) {
    console.error('Animation tick error:', error);
  }
};

/**
 * Get animation factory for direct access
 */
export const getAnimationFactory = (): any => {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    window.AnimationLib?.AnimationFactory ||
    window.AnimationFactory ||
    null
  );
};

/**
 * Check if animation engine is available
 */
export const isAnimationEngineReady = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!(
    window.AnimationEngine &&
    window.AnimationLib?.AnimationFactory
  );
};
