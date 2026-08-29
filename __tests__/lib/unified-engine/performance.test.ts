import { renderHook, act } from '@testing-library/react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';

describe('Unified Engine Performance', () => {
  test('rapid state updates complete without errors', () => {
    const { result } = renderHook(() => useUnifiedEngine());
    const start = performance.now();

    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.setCurrentTime(Math.random() * 10000);
        result.current.setRevealSpeed(Math.random() * 100);
        result.current.setHandSpeed(Math.random() * 100);
      }
    });

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500); // Should complete in under 500ms
  });

  test('large annotation lists perform efficiently', () => {
    const { result } = renderHook(() => useUnifiedEngine());
    const start = performance.now();

    act(() => {
      for (let i = 0; i < 50; i++) {
        result.current.addAnnotation({
          id: `annot-${i}`,
          text: `Annotation ${i}`,
          region: { x: i * 10, y: i * 10, width: 100, height: 100 },
          reveal: { from: i * 100, to: (i + 1) * 100, durationMs: 100, startMs: i * 100 },
        });
      }
    });

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
    expect(result.current.annotations).toHaveLength(50);
  });

  test('layer operations scale linearly', () => {
    const { result } = renderHook(() => useUnifiedEngine());
    const start = performance.now();

    act(() => {
      for (let i = 0; i < 20; i++) {
        result.current.addLayer({
          id: `layer-${i}`,
          name: `Layer ${i}`,
          x: i * 10,
          y: i * 10,
          w: 100,
          h: 100,
          opacity: 1,
          visible: true,
        });
      }
    });

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
    expect(result.current.layers).toHaveLength(21); // 20 + 1 default
  });

  test('state reset is performant', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    // Add lots of data
    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.addAnnotation({
          id: `annot-${i}`,
          text: `Annotation ${i}`,
          region: { x: 0, y: 0, width: 100, height: 100 },
          reveal: { from: 0, to: 1000, durationMs: 1000, startMs: 0 },
        });
      }
    });

    const start = performance.now();
    act(() => {
      result.current.reset();
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(result.current.annotations).toHaveLength(0);
  });
});
