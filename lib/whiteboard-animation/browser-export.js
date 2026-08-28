/**
 * Browser Export for lib/AnimationFactory
 * Exposes lib as global window.AnimationFactory for frontend use
 *
 * Include before using lib/:
 * <script src="lib/Animation.js"></script>
 * <script src="lib/AnimationUtils.js"></script>
 * <script src="lib/styles/*.js"></script>
 * <script src="lib/browser-export.js"></script>
 */

// This file will be built via webpack/rollup to create a browser bundle
// For now, provide a stub that assumes lib/ is available via module system

if (typeof window !== 'undefined') {
  // Browser environment - assume bundler will provide AnimationFactory
  // This is set by the build output
  window.AnimationFactory = window.AnimationFactory || undefined;

  if (!window.AnimationFactory) {
    console.warn('AnimationFactory not available. Make sure lib is bundled or webpack is configured.');
  }
}
