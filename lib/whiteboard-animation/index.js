const Animation = require('./Animation');
const { Scanner, Contour, OutlineChunks, ChunkJump, OutlineFill, Nervous, TopAnchor, Scribble, Specialized, Gesture, IllustFill, OutlineOnly, SpecText } = require('./styles');
const { CUSTOM_HANDS } = require('./hands');
const annotationCoords = require('./annotationCoords');
const handLayout = require('./handLayout');
const projet = require('./project');

/**
 * Factory to create animation instances.
 * Centralizes animation creation logic for both frontend and backend.
 */
class AnimationFactory {
  static create(styleName, options) {
    const styles = {
      'scanner': Scanner,
      'contour': Contour,
      'outlinechunks': OutlineChunks,
      'chunkjump': ChunkJump,
      'outlinefill': OutlineFill,
      'nervous': Nervous,
      'topanchor': TopAnchor,
      'scribble': Scribble,
      'specialized': Specialized,
      'gesture': Gesture,
      'illustfill': IllustFill,
      'outlineonly': OutlineOnly,
      'spec-text': SpecText,
    };

    // Handle spec-* variants
    let AnimationClass = styles[styleName];
    let kind = null;

    if (!AnimationClass && styleName.startsWith('spec-')) {
      const variant = styleName.substring(5); // remove 'spec-' prefix
      if (['human', 'animal', 'portrait', 'vehicle', 'building', 'landscape', 'spiral', 'nature', 'explode'].includes(variant)) {
        AnimationClass = Specialized;
        kind = variant;
      }
    }

    if (!AnimationClass) {
      throw new Error(`Unknown animation style: ${styleName}. Available: ${Object.keys(styles).join(', ')}`);
    }

    const opts = kind ? { ...options, kind } : options;
    return new AnimationClass(opts);
  }
}

// Export as both CommonJS and default for webpack UMD
module.exports = AnimationFactory;
module.exports.AnimationFactory = AnimationFactory;
module.exports.projectAnnotations = annotationCoords.projectAnnotations;
module.exports.regionToCanvasRect = annotationCoords.regionToCanvasRect;
module.exports.timelineDurationMs = annotationCoords.timelineDurationMs;
module.exports.handDrawRect = handLayout.handDrawRect;
module.exports.buildProjectSchedule = projet.buildProjectSchedule;
module.exports.projectDurationMs = projet.projectDurationMs;
module.exports.sceneA = projet.sceneA;
module.exports.Animation = Animation;
module.exports.Scanner = Scanner;
module.exports.Contour = Contour;
module.exports.OutlineChunks = OutlineChunks;
module.exports.ChunkJump = ChunkJump;
module.exports.OutlineFill = OutlineFill;
module.exports.Nervous = Nervous;
module.exports.TopAnchor = TopAnchor;
module.exports.Scribble = Scribble;
module.exports.Specialized = Specialized;
module.exports.Gesture = Gesture;
module.exports.IllustFill = IllustFill;
module.exports.OutlineOnly = OutlineOnly;
module.exports.SpecText = SpecText;
module.exports.CUSTOM_HANDS = CUSTOM_HANDS;
module.exports.default = AnimationFactory;
