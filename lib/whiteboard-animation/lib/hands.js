/**
 * Unified Hand Cursor Configuration
 * Single source of truth for hand styling across frontend + backend
 *
 * Used by:
 * - Frontend (app/animations-unified.js)
 * - Backend (server/canvas-renderer.js)
 */

const CUSTOM_HANDS = {
  'custom1': {
    name: 'Custom Hand 1',
    images: {
      720: { path: 'images/hand1-720p.png', width: 432, height: 768, tipX: 229, tipY: 0 },
      1080: { path: 'images/hand1-1080p.png', width: 648, height: 1152, tipX: 325, tipY: 1 },
      1440: { path: 'images/hand1-1440p.png', width: 864, height: 1536, tipX: 448, tipY: 1 },
      '720v': { path: 'images/hand1vertical-720p.png', width: 720, height: 1280, tipX: 0, tipY: 0 },
      '1080v': { path: 'images/hand1vertical-1080p.png', width: 1080, height: 1920, tipX: 0, tipY: 0 },
      '1440v': { path: 'images/hand1vertical-1440p.png', width: 1440, height: 2560, tipX: 0, tipY: 0 },
    }
  },
  'custom2': {
    name: 'Custom Hand 2',
    images: {
      720: { path: 'images/hand2-720p.png', width: 432, height: 768, tipX: 166, tipY: 0 },
      1080: { path: 'images/hand2-1080p.png', width: 648, height: 1152, tipX: 249, tipY: 0 },
      1440: { path: 'images/hand2-1440p.png', width: 864, height: 1536, tipX: 345, tipY: 0 },
      '720v': { path: 'images/hand2vertical-720p.png', width: 720, height: 1280, tipX: 0, tipY: 0 },
      '1080v': { path: 'images/hand2vertical-1080p.png', width: 1080, height: 1920, tipX: 0, tipY: 0 },
      '1440v': { path: 'images/hand2vertical-1440p.png', width: 1440, height: 2560, tipX: 0, tipY: 0 },
    }
  },
  'custom3': {
    name: 'Custom Hand 3',
    images: {
      720: { path: 'images/hand3-720p.png', width: 432, height: 768, tipX: 117, tipY: 0 },
      1080: { path: 'images/hand3-1080p.png', width: 648, height: 1152, tipX: 196, tipY: 0 },
      1440: { path: 'images/hand3-1440p.png', width: 864, height: 1536, tipX: 266, tipY: 1 },
      '720v': { path: 'images/hand3vertical-720p.png', width: 720, height: 1280, tipX: 1, tipY: 0 },
      '1080v': { path: 'images/hand3vertical-1080p.png', width: 1080, height: 1920, tipX: 0, tipY: 0 },
      '1440v': { path: 'images/hand3vertical-1440p.png', width: 1440, height: 2560, tipX: 0, tipY: 0 },
    }
  },
  'custom4': {
    name: 'Custom Hand 4',
    images: {
      720: { path: 'images/hand4-720p.png', width: 432, height: 768, tipX: 81, tipY: 628 },
      1080: { path: 'images/hand4-1080p.png', width: 648, height: 1152, tipX: 140, tipY: 904 },
      1440: { path: 'images/hand4-1440p.png', width: 864, height: 1536, tipX: 175, tipY: 1214 },
      '720v': { path: 'images/hand4vertical-720p.png', width: 432, height: 768, tipX: 81, tipY: 628 },
      '1080v': { path: 'images/hand4vertical-1080p.png', width: 450, height: 750, tipX: 225, tipY: 150 },
      '1440v': { path: 'images/hand4vertical-1440p.png', width: 864, height: 1536, tipX: 175, tipY: 1213 },
    }
  }
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CUSTOM_HANDS };
} else {
  // Browser: attach to window
  window.CUSTOM_HANDS = CUSTOM_HANDS;
}
