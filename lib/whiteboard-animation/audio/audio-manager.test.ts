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

  it("setPlaybackRate/getPlaybackRate round-trip on the element", () => {
    manager.setPlaybackRate(1.05);
    expect(manager.getPlaybackRate()).toBeCloseTo(1.05, 5);
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

  describe("isUsableClock", () => {
    const setReadyState = (el: HTMLMediaElement, value: number) =>
      Object.defineProperty(el, "readyState", { value, configurable: true });

    it("is false for a stalled load that never errors", () => {
      // The bug this guards: a stalled track sits at HAVE_NOTHING with no
      // `error` event, so an error check alone reports it as playable and the
      // renderer freezes waiting for a clock that never ticks.
      const el = manager.getElement();
      setReadyState(el, 0);
      expect(el.error).toBeFalsy();
      expect(manager.isUsableClock()).toBe(false);
    });

    it("is false while only metadata has arrived", () => {
      const el = manager.getElement();
      setReadyState(el, HTMLMediaElement.HAVE_METADATA);
      expect(manager.isUsableClock()).toBe(false);
    });

    it("is true once current data is available", () => {
      const el = manager.getElement();
      setReadyState(el, HTMLMediaElement.HAVE_CURRENT_DATA);
      expect(manager.isUsableClock()).toBe(true);
    });

    it("is false while the element is seeking", () => {
      // Guards a seek/re-buffer ping-pong: a mid-seek element reports a
      // position that is about to change, and treating it as a clock made the
      // caller correct it again on the next frame, forever.
      const el = manager.getElement();
      setReadyState(el, HTMLMediaElement.HAVE_ENOUGH_DATA);
      Object.defineProperty(el, "seeking", { value: true, configurable: true });
      expect(manager.isUsableClock()).toBe(false);
    });

    it("is false once the track has ended", () => {
      // A finished track stops advancing, so it can no longer drive timing: a
      // narration shorter than the drawing must hand back to the wall clock
      // instead of stalling the engine on a frozen currentTime.
      const el = manager.getElement();
      setReadyState(el, HTMLMediaElement.HAVE_ENOUGH_DATA);
      Object.defineProperty(el, "ended", { value: true, configurable: true });
      expect(manager.isUsableClock()).toBe(false);
    });

    it("is false when the element reports an error despite buffered data", () => {
      const el = manager.getElement();
      setReadyState(el, HTMLMediaElement.HAVE_ENOUGH_DATA);
      // jsdom exposes no MediaError constructor; the code value is all
      // isUsableClock cares about.
      Object.defineProperty(el, "error", {
        value: { code: 3 },
        configurable: true,
      });
      expect(manager.isUsableClock()).toBe(false);
    });
  });

  it("reports a load failure to onError", async () => {
    const onError = vi.fn();
    const m = new AudioManager(onError);
    await m.load("https://example.com/missing.mp3");
    m.getElement().dispatchEvent(new Event("error"));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toContain("missing.mp3");
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
