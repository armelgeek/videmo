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

    let targetStyle = (styleName || 'chunkjump').toLowerCase();

    // Map variant shorthand names (human, animal, spiral...) to spec-*
    const variants = ['human', 'animal', 'portrait', 'vehicle', 'building', 'landscape', 'spiral', 'nature', 'explode'];
    if (variants.includes(targetStyle)) {
      targetStyle = `spec-${targetStyle}`;
    }

    let AnimationClass = styles[targetStyle];
    let kind = null;

    if (!AnimationClass && targetStyle.startsWith('spec-')) {
      const variant = targetStyle.substring(5); // remove 'spec-' prefix
      if (variants.includes(variant)) {
        AnimationClass = Specialized;
        kind = variant;
      }
    }

    // Fallback safely to ChunkJump if style is unknown
    if (!AnimationClass) {
      console.warn(`Unknown animation style: ${styleName}. Falling back to chunkjump.`);
      AnimationClass = ChunkJump;
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
