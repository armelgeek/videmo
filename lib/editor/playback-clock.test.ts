import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  subscribeToPlaybackPosition,
  readPlaybackPosition,
  setPlaybackPosition,
} from "./playback-clock";

describe("playback clock", () => {
  beforeEach(() => {
    setPlaybackPosition(0);
  });

  it("returns the last position set", () => {
    setPlaybackPosition(12.5);
    expect(readPlaybackPosition()).toBe(12.5);
  });

  it("wakes nobody when the value does not change", () => {
    // The loop calls every frame, even when nothing moves: an unchanged
    // position must trigger no render.
    const seen: number[] = [];
    const unsubscribe = subscribeToPlaybackPosition(() => seen.push(readPlaybackPosition()));

    setPlaybackPosition(1);
    setPlaybackPosition(1);
    setPlaybackPosition(2);

    unsubscribe();
    expect(seen).toEqual([1, 2]);
  });

  it("stops waking after unsubscribe, but keeps the value", () => {
    const subscriber = vi.fn();
    const unsubscribe = subscribeToPlaybackPosition(subscriber);

    setPlaybackPosition(3);
    unsubscribe();
    setPlaybackPosition(4);

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(readPlaybackPosition()).toBe(4);
  });

  it("serves several subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeToPlaybackPosition(a);
    const unsubB = subscribeToPlaybackPosition(b);

    setPlaybackPosition(7);

    unsubA();
    unsubB();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
