import { describe, expect, it } from "vitest";
import { NarrationPlayer } from "./narration-player";

/**
 * jsdom stubs play()/pause()/load() as no-ops, but currentTime, playbackRate
 * and readyState remain real properties: tempo catch-up touches nothing else,
 * so it can be proven directly here, unlike the rest of the player (see the
 * NarrationPlayer class comment).
 */
const setReadyState = (el: HTMLMediaElement, value: number) =>
  Object.defineProperty(el, "readyState", { value, configurable: true });

const setCurrentTime = (el: HTMLMediaElement, seconds: number) =>
  Object.defineProperty(el, "currentTime", { value: seconds, writable: true, configurable: true });

describe("NarrationPlayer — catching up a gap", () => {
  it("nudges the tempo for a small gap, without jumping", () => {
    const player = new NarrationPlayer([{ url: "a", startMs: 0, durationMs: 5000 }]);
    player.prepare();
    const el = player.getElement();
    setReadyState(el, HTMLMediaElement.HAVE_CURRENT_DATA);
    setCurrentTime(el, 0.2);

    player.seekMs(700);

    expect(el.currentTime).toBeCloseTo(0.2, 5);
    expect(el.playbackRate).toBeGreaterThan(1);
    expect(el.playbackRate).toBeLessThanOrEqual(1.05);
  });

  it("jumps directly for a huge gap", () => {
    const player = new NarrationPlayer([{ url: "a", startMs: 0, durationMs: 5000 }]);
    player.prepare();
    const el = player.getElement();
    setReadyState(el, HTMLMediaElement.HAVE_CURRENT_DATA);
    setCurrentTime(el, 0.2);

    player.seekMs(3000);

    expect(el.currentTime).toBeCloseTo(3, 5);
    expect(el.playbackRate).toBe(1);
  });

  it("returns to normal tempo once the gap is absorbed", () => {
    const player = new NarrationPlayer([{ url: "a", startMs: 0, durationMs: 5000 }]);
    player.prepare();
    const el = player.getElement();
    setReadyState(el, HTMLMediaElement.HAVE_CURRENT_DATA);
    setCurrentTime(el, 0.2);

    player.seekMs(700);
    expect(el.playbackRate).not.toBe(1);

    setCurrentTime(el, 0.7);
    player.seekMs(700);

    expect(el.playbackRate).toBe(1);
  });

  it("does not request another seek until the previous one completes", () => {
    const player = new NarrationPlayer([{ url: "a", startMs: 0, durationMs: 5000 }]);
    player.prepare();
    const el = player.getElement();
    setReadyState(el, HTMLMediaElement.HAVE_CURRENT_DATA);
    setCurrentTime(el, 0.2);
    Object.defineProperty(el, "seeking", { value: true, configurable: true });

    player.seekMs(3000);

    // Still at the previous position: the seek was refused during the
    // previous one (simulated here via `seeking`), not replayed on top.
    expect(el.currentTime).toBeCloseTo(0.2, 5);
  });
});
