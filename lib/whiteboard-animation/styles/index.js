// Export all animation styles from individual files

const Scanner = require('./Scanner');
const Contour = require('./Contour');
const OutlineChunks = require('./OutlineChunks');
const ChunkJump = require('./ChunkJump');
const OutlineFill = require('./OutlineFill');
const Nervous = require('./Nervous');
const TopAnchor = require('./TopAnchor');
const Scribble = require('./Scribble');
const Specialized = require('./Specialized');
const Gesture = require('./Gesture');
const IllustFill = require('./IllustFill');
const SpecText = require('./SpecText');

// OutlineOnly is IllustFill in outline-only mode
class OutlineOnly extends IllustFill {
  constructor(options) {
    super({ ...options, mode: 'outlineonly' });
  }
}

module.exports = {
  Scanner,
  Contour,
  OutlineChunks,
  ChunkJump,
  OutlineFill,
  Nervous,
  TopAnchor,
  Scribble,
  Specialized,
  Gesture,
  IllustFill,
  OutlineOnly,
  SpecText
};
