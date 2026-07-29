import { describe, expect, it, vi, beforeEach } from "vitest";
import { AudioManager } from "./audio-manager";

// jsdom's HTMLMediaElement has no real decoder: play()/pause() exist but do
// nothing, and duration/currentTime are plain settable properties. Tests
// drive those properties directly and dispatch the events AudioManager
// listens for, rather than relying on real playback.

describe("AudioManager", () => {
  let manager: AudioManager;

  beforeEach(() => {
    manager = new AudioManager();
  });

  it("starts with currentMs at 0 and durationMs at 0", () => {
    expect(manager.getCurrentMs()).toBe(0);
    expect(manager.getDurationMs()).toBe(0);
  });

  it("converts currentTime seconds to milliseconds", () => {
    const el = manager.getElement();
    Object.defineProperty(el, "currentTime", { value: 2.5, writable: true });
    el.dispatchEvent(new Event("timeupdate"));
    expect(manager.getCurrentMs()).toBe(2500);
  });

  it("converts duration seconds to milliseconds on loadedmetadata", () => {
    const el = manager.getElement();
    Object.defineProperty(el, "duration", { value: 12.34, writable: true });
    el.dispatchEvent(new Event("loadedmetadata"));
    expect(manager.getDurationMs()).toBe(12340);
  });

  it("seekMs converts milliseconds to currentTime seconds", () => {
    const el = manager.getElement();
    manager.seekMs(4200);
    expect(el.currentTime).toBeCloseTo(4.2, 5);
  });

  it("setVolume clamps to [0, 1]", () => {
    const el = manager.getElement();
    manager.setVolume(1.5);
    expect(el.volume).toBe(1);
    manager.setVolume(-0.5);
    expect(el.volume).toBe(0);
    manager.setVolume(0.7);
    expect(el.volume).toBeCloseTo(0.7, 5);
  });

  it("setMuted sets the element's muted flag", () => {
    const el = manager.getElement();
    manager.setMuted(true);
    expect(el.muted).toBe(true);
    manager.setMuted(false);
    expect(el.muted).toBe(false);
  });

  it("onTimeUpdate invokes the callback with milliseconds on each timeupdate", () => {
    const cb = vi.fn();
    manager.onTimeUpdate(cb);
    const el = manager.getElement();
    Object.defineProperty(el, "currentTime", { value: 1.0, writable: true });
    el.dispatchEvent(new Event("timeupdate"));
    expect(cb).toHaveBeenCalledWith(1000);
  });

  it("onTimeUpdate returns an unsubscribe function", () => {
    const cb = vi.fn();
    const unsubscribe = manager.onTimeUpdate(cb);
    unsubscribe();
    const el = manager.getElement();
    Object.defineProperty(el, "currentTime", { value: 1.0, writable: true });
    el.dispatchEvent(new Event("timeupdate"));
    expect(cb).not.toHaveBeenCalled();
  });

  it("destroy removes all listeners and pauses playback", () => {
    const cb = vi.fn();
    manager.onTimeUpdate(cb);
    const el = manager.getElement();
    const pauseSpy = vi.spyOn(el, "pause");
    manager.destroy();
    expect(pauseSpy).toHaveBeenCalled();
    Object.defineProperty(el, "currentTime", { value: 1.0, writable: true });
    el.dispatchEvent(new Event("timeupdate"));
    expect(cb).not.toHaveBeenCalled();
  });
});
