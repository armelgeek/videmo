import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAudioClock } from "./use-audio-clock";

describe("useAudioClock", () => {
  it("returns null manager and isReady false when url is null", () => {
    const { result } = renderHook(() => useAudioClock(null));
    expect(result.current.manager).toBeNull();
    expect(result.current.isReady).toBe(false);
  });

  it("creates a manager when a url is provided", () => {
    const { result } = renderHook(() => useAudioClock("blob:fake-url"));
    expect(result.current.manager).not.toBeNull();
  });

  it("becomes ready after loadedmetadata fires", async () => {
    const { result } = renderHook(() => useAudioClock("blob:fake-url"));
    const el = result.current.manager!.getElement();
    Object.defineProperty(el, "duration", { value: 5, writable: true });
    act(() => {
      el.dispatchEvent(new Event("loadedmetadata"));
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.durationMs).toBe(5000);
  });

  it("does not re-render on timeupdate", () => {
    // The playback position is read off the manager inside the rAF loop.
    // Publishing it through state re-rendered the whole renderer several times
    // a second for a value no consumer reads, so timeupdate must stay inert.
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useAudioClock("blob:fake-url");
    });
    const el = result.current.manager!.getElement();
    const before = renders;

    Object.defineProperty(el, "currentTime", { value: 3, writable: true });
    act(() => {
      el.dispatchEvent(new Event("timeupdate"));
      el.dispatchEvent(new Event("timeupdate"));
      el.dispatchEvent(new Event("timeupdate"));
    });

    expect(renders).toBe(before);
    // The position is still readable, just not through React state.
    expect(result.current.manager!.getCurrentMs()).toBe(3000);
  });

  it("destroys the manager and creates a fresh one when url changes", () => {
    const { result, rerender } = renderHook(
      ({ url }) => useAudioClock(url),
      { initialProps: { url: "blob:first" } }
    );
    const firstManager = result.current.manager;
    const destroySpy = vi.spyOn(firstManager!, "destroy");

    rerender({ url: "blob:second" });

    expect(destroySpy).toHaveBeenCalled();
    expect(result.current.manager).not.toBe(firstManager);
  });

  it("destroys the manager on unmount", () => {
    const { result, unmount } = renderHook(() => useAudioClock("blob:fake-url"));
    const destroySpy = vi.spyOn(result.current.manager!, "destroy");
    unmount();
    expect(destroySpy).toHaveBeenCalled();
  });
});
