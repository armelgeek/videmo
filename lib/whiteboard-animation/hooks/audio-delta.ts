/**
 * How far the narration may sit from the drawing before it is pulled back.
 *
 * The drawing owns the timeline and the audio follows it, so this is the
 * tolerance for correcting the AUDIO — not, as it once was, for dragging the
 * picture to wherever the media element happened to be.
 *
 * 120ms sits below the usual audio/visual lag perception threshold (~125ms),
 * so the offset is corrected before it can be noticed, while staying wide
 * enough that normal jitter does not cause an audible seek every frame.
 */
export const DRIFT_MAX_MS = 120;
