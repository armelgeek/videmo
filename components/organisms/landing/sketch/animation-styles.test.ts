import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ANIMATION_STYLES } from './animation-styles';
import { isPremiumStyle } from '../../../../lib/whiteboard-animation/style-tiers';

import { AnimationFactory } from '../../../../lib/whiteboard-animation/AnimationFactory';

/**
 * The landing long advertised made-up styles — sharpie, chalk, watercolor —
 * that existed nowhere in the engine. A visitor who picked them got a chunkjump
 * render with no warning: the factory silently falls back to its default. This
 * file ties the showcase to the engine so the drift cannot come back.
 */
describe('styles advertised on the landing', () => {
  it('are all known to the factory', () => {
    const unknown = ANIMATION_STYLES.filter(
      (s) => !AnimationFactory.isStyleAvailable(s.id),
    );

    expect(unknown.map((s) => s.id)).toEqual([]);
  });

  it('each have their demo and its poster image', () => {
    const root = join(process.cwd(), 'public', 'demos', 'styles');
    const missing: string[] = [];

    for (const s of ANIMATION_STYLES) {
      if (!existsSync(join(root, `${s.id}.mp4`))) missing.push(`${s.id}.mp4`);
      if (!existsSync(join(root, `${s.id}.webp`))) missing.push(`${s.id}.webp`);
    }

    expect(missing).toEqual([]);
  });

  it('offer at least one free style and one premium style', () => {
    const tiers = new Set(ANIMATION_STYLES.map((s) => s.tier));
    expect(tiers.has('free')).toBe(true);
    expect(tiers.has('premium')).toBe(true);
  });

  it('do not advertise the same style twice', () => {
    const ids = ANIMATION_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('show the same free/pro badge as the rule applied at export', () => {
    const mismatches = ANIMATION_STYLES.filter(
      (s) => (s.tier === 'premium') !== isPremiumStyle(s.id),
    );
    expect(mismatches.map((s) => s.id)).toEqual([]);
  });
});
