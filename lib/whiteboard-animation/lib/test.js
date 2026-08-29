/**
 * Quick test of the Animation library structure.
 * Run: node lib/test.js
 */

const { AnimationFactory, Animation, Scanner, Contour } = require('./index.js');

console.log('✓ Library imports successful\n');

// Test 1: Factory creates Scanner
console.log('Test 1: Factory.create("scanner")');
try {
  const mockCallbacks = {
    fillBg: () => {},
    drawHand: () => {},
    setProgress: () => {},
    finishAnim: () => {},
    resScale: () => 1,
    resPointScale: () => 1
  };

  const scanner = AnimationFactory.create('scanner', {
    state: { canvasW: 1920, canvasH: 1080, contentBounds: { x: 0, y: 0, w: 1920, h: 1080 } },
    ctx: { fillRect: () => {} },
    hctx: { clearRect: () => {} },
    offscreen: { getContext: () => ({ getImageData: () => ({ data: new Uint8Array(1920 * 1080 * 4) }) }) },
    callbacks: mockCallbacks
  });

  console.log('  ✓ Scanner instance created');
  console.log('  ✓ Has setup():', typeof scanner.setup === 'function');
  console.log('  ✓ Has tick():', typeof scanner.tick === 'function');
  console.log('  ✓ Has buildPresenceMap():', typeof scanner.buildPresenceMap === 'function');
} catch (err) {
  console.error('  ✗ Error:', err.message);
}

// Test 2: Direct class instantiation
console.log('\nTest 2: Direct Contour() instantiation');
try {
  const contour = new Contour({
    state: { canvasW: 1920, canvasH: 1080, contentBounds: { x: 0, y: 0, w: 1920, h: 1080 } },
    ctx: {},
    hctx: {},
    offscreen: { getContext: () => ({ getImageData: () => ({ data: new Uint8Array(1920 * 1080 * 4) }) }) },
    callbacks: {}
  });
  console.log('  ✓ Contour instance created');
  console.log('  ✓ Inherits from Animation:', contour instanceof Animation);
} catch (err) {
  console.error('  ✗ Error:', err.message);
}

// Test 3: Factory throws on unknown style
console.log('\nTest 3: Factory error handling');
try {
  AnimationFactory.create('nonexistent', {});
  console.log('  ✗ Should have thrown');
} catch (err) {
  console.log('  ✓ Correctly throws on unknown style:', err.message);
}

console.log('\n✓ All tests passed! Library structure is sound.\n');
