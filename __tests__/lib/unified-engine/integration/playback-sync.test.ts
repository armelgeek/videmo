import { renderHook, act } from '@testing-library/react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
import { selectProgress } from '@/lib/unified-engine/hooks/selectors';

describe('Unified Engine Playback Sync', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useUnifiedEngine());
    act(() => {
      result.current.reset();
    });
  });

  test('timeline seek syncs with animation progress', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    act(() => {
      result.current.setDuration(10000);
      result.current.setCurrentTime(5000);
    });

    // Progress should be 50%
    expect(result.current.progress).toBe(50);
  });

  test('play/pause state syncs between timeline and animation', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    act(() => {
      result.current.togglePlay();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(result.current.timeline.isPlaying).toBe(true);

    act(() => {
      result.current.togglePlay();
    });

    expect(result.current.isPlaying).toBe(false);
  });

  test('animation settings persist across play cycles', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    act(() => {
      result.current.setAnimStyle('scribble');
      result.current.setRevealSpeed(75);
      result.current.togglePlay();
    });

    // Settings should persist
    expect(result.current.animStyle).toBe('scribble');
    expect(result.current.revealSpeed).toBe(75);
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.togglePlay();
    });

    expect(result.current.animStyle).toBe('scribble');
    expect(result.current.revealSpeed).toBe(75);
  });

  test('annotations sync with timeline', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    act(() => {
      result.current.addAnnotation({
        id: 'annot-1',
        text: 'First annotation',
        region: { x: 10, y: 10, width: 100, height: 100 },
        reveal: { from: 0, to: 2000, durationMs: 2000, startMs: 0 },
      });

      result.current.addAnnotation({
        id: 'annot-2',
        text: 'Second annotation',
        region: { x: 20, y: 20, width: 150, height: 150 },
        reveal: { from: 2000, to: 4000, durationMs: 2000, startMs: 2000 },
      });
    });

    expect(result.current.annotations).toHaveLength(2);

    // Update annotation
    act(() => {
      result.current.updateAnnotation(0, { text: 'Updated annotation' });
    });

    expect(result.current.annotations[0].text).toBe('Updated annotation');
  });

  test('canvas size changes sync with resolution', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    act(() => {
      result.current.setCanvasSize(1920, 1080);
      result.current.setResolution('1080p');
    });

    expect(result.current.canvasWidth).toBe(1920);
    expect(result.current.canvasHeight).toBe(1080);
    expect(result.current.resolution).toBe('1080p');
  });

  test('currentTime clamps to duration', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    act(() => {
      result.current.setDuration(5000);
      result.current.setCurrentTime(10000);
    });

    expect(result.current.currentTime).toBe(5000);
  });

  test('progress derived correctly from currentTime and duration', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    act(() => {
      result.current.setDuration(10000);
    });

    // At 0ms
    act(() => {
      result.current.setCurrentTime(0);
    });
    expect(result.current.progress).toBe(0);

    // At 2500ms (25%)
    act(() => {
      result.current.setCurrentTime(2500);
    });
    expect(result.current.progress).toBe(25);

    // At 5000ms (50%)
    act(() => {
      result.current.setCurrentTime(5000);
    });
    expect(result.current.progress).toBe(50);

    // At 10000ms (100%)
    act(() => {
      result.current.setCurrentTime(10000);
    });
    expect(result.current.progress).toBe(100);
  });
});
