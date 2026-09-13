import { renderHook, act } from '@testing-library/react';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';

describe('UnifiedEngineStore', () => {
  beforeEach(() => {
    useUnifiedEngineStore.setState({
      timeline: {
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        fps: 60,
        clips: [],
      },
      animation: {
        layers: [],
        animStyle: 'chunkjump',
        handStyle: 'custom1',
        revealSpeed: 40,
        handSpeed: 6,
        chunks: 5,
        canvasBg: '#ffffff',
        useAnnotation: false,
        annotations: [],
      },
      canvas: {
        width: 1280,
        height: 720,
        aspectRatio: '16:9',
        resolution: '720p',
      },
      ui: {
        selectedClipId: null,
        selectedAnnotationIndex: null,
        activeScenePanelId: null,
        activePanel: 'timeline',
        isLoading: false,
        error: null,
      },
    });
  });

  test('sets current time', () => {
    const { result } = renderHook(() => useUnifiedEngineStore());

    act(() => {
      // setCurrentTime clamps to duration, which starts at 0.
      result.current.setDuration(5000);
      result.current.setCurrentTime(1000);
    });

    expect(result.current.timeline.currentTime).toBe(1000);
  });

  test('clamps current time to duration', () => {
    const { result } = renderHook(() => useUnifiedEngineStore());

    act(() => {
      result.current.setDuration(5000);
      result.current.setCurrentTime(10000);
    });

    expect(result.current.timeline.currentTime).toBe(5000);
  });

  test('toggles play state', () => {
    const { result } = renderHook(() => useUnifiedEngineStore());

    expect(result.current.timeline.isPlaying).toBe(false);

    act(() => {
      result.current.togglePlay();
    });

    expect(result.current.timeline.isPlaying).toBe(true);
  });

  test('adds annotation', () => {
    const { result } = renderHook(() => useUnifiedEngineStore());

    act(() => {
      result.current.addAnnotation({
        id: 'annot-1',
        text: 'Test',
        region: { x: 0, y: 0, width: 100, height: 100 },
        reveal: { from: 0, to: 1000, durationMs: 1000, startMs: 0 },
      });
    });

    expect(result.current.animation.annotations).toHaveLength(1);
  });

  test('resets state', () => {
    const { result } = renderHook(() => useUnifiedEngineStore());

    act(() => {
      result.current.setCurrentTime(5000);
      result.current.setIsPlaying(true);
      result.current.reset();
    });

    expect(result.current.timeline.currentTime).toBe(0);
    expect(result.current.timeline.isPlaying).toBe(false);
  });
});
