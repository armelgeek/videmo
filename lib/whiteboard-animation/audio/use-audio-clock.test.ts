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

  it("updates currentMs on timeupdate", async () => {
    const { result } = renderHook(() => useAudioClock("blob:fake-url"));
    const el = result.current.manager!.getElement();
    Object.defineProperty(el, "currentTime", { value: 3, writable: true });
    act(() => {
      el.dispatchEvent(new Event("timeupdate"));
    });
    await waitFor(() => expect(result.current.currentMs).toBe(3000));
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
