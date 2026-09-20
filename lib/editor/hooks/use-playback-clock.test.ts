import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readPlaybackPosition, setPlaybackPosition } from "../playback-clock";
import { usePlayback } from "./use-playback";

/**
 * What is checked here is the clock SEMANTICS, not media playback:
 * `currentTime` no longer follows playback frame by frame — the external
 * clock carries it — but it must still mark discrete instants, and above all
 * the position playback resumes from after a pause.
 */

const options = {
  timelineClips: [],
  tracks: [],
  mediaMap: {},
  timelineDuration: 30,
  isExporting: false,
  isRendering: false,
};

/**
 * A simulated requestAnimationFrame: callbacks are queued, and `advance`
 * replays them with a clock the test controls. Using real timers would make
 * the measurement depend on elapsed wall time.
 */
let clock = 0;
let pending = new Map<number, FrameRequestCallback>();
let nextId = 1;

/** Runs the loop for `ms` milliseconds of simulated time. */
async function advance(ms: number) {
  const step = 16;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    clock += step;
    const toRun = [...pending.entries()];
    pending = new Map();
    await act(async () => {
      for (const [, cb] of toRun) cb(clock);
    });
  }
}

describe("usePlayback — clock", () => {
  beforeEach(() => {
    setPlaybackPosition(0);
    clock = 0;
    pending = new Map();
    nextId = 1;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      pending.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("advances the external clock during playback", async () => {
    const { result } = renderHook(() => usePlayback(options));

    act(() => {
      result.current.setIsPlaying(true);
    });
    await advance(300);

    expect(readPlaybackPosition()).toBeGreaterThan(0);
  });

  it("resumes playback where the pause left it", async () => {
    const { result } = renderHook(() => usePlayback(options));

    act(() => {
      result.current.setIsPlaying(true);
    });
    await advance(300);

    const atPause = readPlaybackPosition();
    expect(atPause).toBeGreaterThan(0);

    act(() => {
      result.current.setIsPlaying(false);
    });

    // Stopping publishes the ACTUAL position into React state: otherwise it
    // would still hold the last seek's position and resume from there.
    expect(result.current.currentTime).toBeCloseTo(atPause, 5);

    act(() => {
      result.current.setIsPlaying(true);
    });
    await advance(100);

    expect(readPlaybackPosition()).toBeGreaterThanOrEqual(atPause);
  });

  it("a seek sets the position on the external clock and in state", () => {
    const { result } = renderHook(() => usePlayback(options));

    act(() => {
      result.current.handleSeek(12);
    });

    expect(readPlaybackPosition()).toBe(12);
    expect(result.current.currentTime).toBe(12);
  });

  it("does not restart from the beginning when clips change identity mid-playback", async () => {
    const { result, rerender } = renderHook((props) => usePlayback(props), {
      initialProps: { ...options },
    });

    act(() => {
      result.current.setIsPlaying(true);
    });
    await advance(300);

    const beforeRerender = readPlaybackPosition();
    expect(beforeRerender).toBeGreaterThan(0);

    // An empty BUT new array: this is what any upstream render that rebuilds
    // its clips produces. It renewed `animate`'s identity, re-ran the start
    // effect, and sent it back to the resume position.
    rerender({ ...options, timelineClips: [] });
    await advance(100);

    expect(readPlaybackPosition()).toBeGreaterThanOrEqual(beforeRerender);
  });

  it("does not jump to the end when a frame arrives very late", async () => {
    const { result } = renderHook(() => usePlayback(options));

    act(() => {
      result.current.setIsPlaying(true);
    });
    await advance(100);

    const beforeFreeze = readPlaybackPosition();

    // A main-thread freeze, like the one caused by loading the source when
    // moving to the next clip: the next frame arrives ten seconds later, well
    // past `timelineDuration`.
    clock += 10_000;
    const toRun = [...pending.values()];
    pending = new Map();
    await act(async () => {
      for (const cb of toRun) cb(clock);
    });

    // Playback falls behind, it does not jump: the playhead moved by at most
    // one bounded step, and the timeline has not reached its end.
    const afterFreeze = readPlaybackPosition();
    expect(afterFreeze).toBeGreaterThan(beforeFreeze);
    expect(afterFreeze).toBeLessThan(beforeFreeze + 0.5);
    expect(result.current.isPlaying).toBe(true);
  });

  it("resumes from the position sought during a pause", async () => {
    const { result } = renderHook(() => usePlayback(options));

    act(() => {
      result.current.handleSeek(5);
    });
    act(() => {
      result.current.setIsPlaying(true);
    });
    await advance(200);

    expect(readPlaybackPosition()).toBeGreaterThanOrEqual(5);
  });
});
