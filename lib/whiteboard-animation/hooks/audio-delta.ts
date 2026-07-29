/**
 * Drift tolerance before the renderer re-syncs the engine to the audio
 * clock. 120ms sits below the usual audio/visual lag perception threshold
 * (~125ms) while staying well above normal timer jitter.
 */
export const DRIFT_MAX_MS = 120;

export interface AudioDeltaInput {
  audioNowMs: number;
  lastAudioMs: number;
  engineTimeMs: number;
}

export interface AudioDeltaResult {
  /** Milliseconds to advance the engine by this tick. Never negative. */
  deltaMs: number;
  /** The audioNowMs value the caller should store as lastAudioMs for next tick. */
  nextLastAudioMs: number;
  /** True if engineTimeMs has drifted from audioNowMs beyond DRIFT_MAX_MS. */
  needsResync: boolean;
  /** When needsResync is true, the absolute time the engine should seek to. */
  resyncTargetMs: number;
}

/**
 * Computes how far to advance the animation engine using the audio clock as
 * the time source, instead of wall-clock time. Unlike the old
 * `Math.min(100, now - last)` loop, this never clamps: if a frame takes
 * 300ms, the audio has genuinely advanced 300ms, so the engine should too.
 *
 * A negative raw delta (the user scrubbed the audio backward) cannot be fed
 * to the engine's forward-only tick — that case is surfaced as needsResync
 * so the caller seeks instead of ticking.
 */
export function computeAudioDelta(input: AudioDeltaInput): AudioDeltaResult {
  const { audioNowMs, lastAudioMs, engineTimeMs } = input;
  const rawDelta = audioNowMs - lastAudioMs;
  const deltaMs = Math.max(0, rawDelta);

  const drift = Math.abs(engineTimeMs - audioNowMs);
  const backwardSeek = rawDelta < 0;
  const needsResync = backwardSeek || drift > DRIFT_MAX_MS;

  return {
    deltaMs,
    nextLastAudioMs: audioNowMs,
    needsResync,
    resyncTargetMs: audioNowMs,
  };
}
