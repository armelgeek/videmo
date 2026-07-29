import { describe, expect, it } from "vitest";
import { computeAudioDelta, DRIFT_MAX_MS } from "./audio-delta";

describe("computeAudioDelta", () => {
  it("returns the difference between audio time and last audio time", () => {
    const result = computeAudioDelta({
      audioNowMs: 1500,
      lastAudioMs: 1000,
      engineTimeMs: 1000,
    });
    expect(result.deltaMs).toBe(500);
  });

  it("does not clamp large deltas the way the old wall-clock loop did", () => {
    const result = computeAudioDelta({
      audioNowMs: 2000,
      lastAudioMs: 1700,
      engineTimeMs: 1700,
    });
    expect(result.deltaMs).toBe(300);
  });

  it("flags no resync when drift is within the threshold", () => {
    const result = computeAudioDelta({
      audioNowMs: 1100,
      lastAudioMs: 1000,
      engineTimeMs: 1050, // 50ms behind audio, under DRIFT_MAX_MS
    });
    expect(result.needsResync).toBe(false);
  });

  it("flags a resync when engine time drifts beyond DRIFT_MAX_MS from audio", () => {
    const result = computeAudioDelta({
      audioNowMs: 2000,
      lastAudioMs: 1900,
      engineTimeMs: 1700, // 300ms behind audio, over DRIFT_MAX_MS (120)
    });
    expect(result.needsResync).toBe(true);
    expect(result.resyncTargetMs).toBe(2000);
  });

  it("treats a negative delta (audio seeked backward) as zero engine advance but still updates lastAudioMs", () => {
    const result = computeAudioDelta({
      audioNowMs: 500,
      lastAudioMs: 1000,
      engineTimeMs: 1000,
    });
    expect(result.deltaMs).toBe(0);
    expect(result.nextLastAudioMs).toBe(500);
  });

  it("DRIFT_MAX_MS is 120", () => {
    expect(DRIFT_MAX_MS).toBe(120);
  });
});
