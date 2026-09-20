import { describe, it, expect } from 'vitest';

const { computeNaturalDuration } = require('./natural-pacing');

describe('computeNaturalDuration', () => {
  // ---------------------------------------------------------------
  // AC-1: Small region with a long audio window → short duration
  // ---------------------------------------------------------------
  it('small region (100×50) with a 5000ms window → result between 300ms and 1500ms', () => {
    const result = computeNaturalDuration({ width: 100, height: 50 }, 5000);
    expect(result).toBeGreaterThanOrEqual(300);
    expect(result).toBeLessThanOrEqual(1500);
  });

  // ---------------------------------------------------------------
  // AC-2: Large region but short audio window → capped at the window
  // ---------------------------------------------------------------
  it('large region needing >700ms but 700ms of audio → result ≤ 700ms', () => {
    const result = computeNaturalDuration({ width: 2000, height: 1500 }, 700);
    expect(result).toBeLessThanOrEqual(700);
    expect(result).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // AC-3: The duration never exceeds the allotted window
  // ---------------------------------------------------------------
  it('the duration never exceeds durationMs', () => {
    const durations = [200, 500, 1000, 3000, 8000];
    for (const d of durations) {
      const result = computeNaturalDuration({ width: 300, height: 200 }, d);
      expect(result).toBeLessThanOrEqual(d);
    }
  });

  // ---------------------------------------------------------------
  // AC-4: Minimum floor of 300ms (unless the window is < 300ms)
  // ---------------------------------------------------------------
  it('300ms floor for a duration >= 300ms', () => {
    const result = computeNaturalDuration({ width: 10, height: 10 }, 5000);
    expect(result).toBeGreaterThanOrEqual(300);
  });

  it('if the window is < 300ms, the floor is the window itself', () => {
    // durationMs=150 → min(300, 150)=150 is the floor
    const result = computeNaturalDuration({ width: 10, height: 10 }, 150);
    expect(result).toBeLessThanOrEqual(150);
    expect(result).toBeGreaterThanOrEqual(100); // window duration floor=100
  });

  // ---------------------------------------------------------------
  // AC-5: Text role with long text → character bonus
  // ---------------------------------------------------------------
  it('role "text" with 30 characters → duration above the area-only computation', () => {
    const withoutText = computeNaturalDuration({ width: 200, height: 40 }, 5000);
    const withText = computeNaturalDuration({ width: 200, height: 40 }, 5000, {
      role: 'text',
      text: 'Ceci est un texte assez long !',
    });
    expect(withText).toBeGreaterThanOrEqual(withoutText);
  });

  // ---------------------------------------------------------------
  // AC-6: Title role → same text bonus logic
  // ---------------------------------------------------------------
  it('role "title" with text uses the character bonus', () => {
    const withTitle = computeNaturalDuration({ width: 150, height: 40 }, 5000, {
      role: 'title',
      text: 'Introduction au chapitre',
    });
    // 23 characters × 40ms = 920ms + 300ms = 1220ms, rounded ≥ 1200ms
    expect(withTitle).toBeGreaterThanOrEqual(1200);
  });

  // ---------------------------------------------------------------
  // AC-7: revealType "fill" → ×1.15 multiplier
  // ---------------------------------------------------------------
  it('revealType "fill" → duration above the same computation without fill', () => {
    const withoutFill = computeNaturalDuration({ width: 400, height: 300 }, 5000);
    const withFill = computeNaturalDuration({ width: 400, height: 300 }, 5000, {
      revealType: 'fill',
    });
    expect(withFill).toBeGreaterThan(withoutFill);
  });

  // ---------------------------------------------------------------
  // AC-8: Natural cap of 2.5s → never > 2500ms
  // ---------------------------------------------------------------
  it('even a huge region does not exceed 2500ms of natural gesture', () => {
    const result = computeNaturalDuration({ width: 10000, height: 10000 }, 20000);
    expect(result).toBeLessThanOrEqual(2500);
  });

  // ---------------------------------------------------------------
  // AC-9: Support { w, h } in addition to { width, height }
  // ---------------------------------------------------------------
  it('accepts { w, h } as an alternative format', () => {
    const a = computeNaturalDuration({ width: 300, height: 200 }, 3000);
    const b = computeNaturalDuration({ w: 300, h: 200 }, 3000);
    expect(a).toBe(b);
  });

  // ---------------------------------------------------------------
  // AC-10: Edge cases — null/undefined region → fallback
  // ---------------------------------------------------------------
  it('null region → uses the defaults (100×100) without crashing', () => {
    expect(() => computeNaturalDuration(null, 2000)).not.toThrow();
    const result = computeNaturalDuration(null, 2000);
    expect(result).toBeGreaterThanOrEqual(300);
    expect(result).toBeLessThanOrEqual(2000);
  });

  it('omitted durationMs → uses 1000ms by default', () => {
    const result = computeNaturalDuration({ width: 100, height: 100 });
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1000);
  });
});
