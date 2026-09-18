import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ANIMATION_STYLES } from './animation-styles';

import { AnimationFactory } from '../../../../lib/whiteboard-animation/AnimationFactory';

/**
 * La landing a longtemps annonce des styles inventes — sharpie, chalk,
 * watercolor — qui n'existaient nulle part dans le moteur. Un visiteur qui les
 * choisissait tombait sur un rendu en chunkjump, sans que rien ne le signale :
 * la factory retombe silencieusement sur son defaut. Ce fichier lie la vitrine
 * au moteur pour que la derive ne puisse pas revenir.
 */
describe('styles annonces sur la landing', () => {
  it('sont tous connus de la factory', () => {
    const inconnus = ANIMATION_STYLES.filter(
      (s) => !AnimationFactory.isStyleAvailable(s.id),
    );

    expect(inconnus.map((s) => s.id)).toEqual([]);
  });

  it('ont chacun leur demo et son image de garde', () => {
    const racine = join(process.cwd(), 'public', 'demos', 'styles');
    const manquants: string[] = [];

    for (const s of ANIMATION_STYLES) {
      if (!existsSync(join(racine, `${s.id}.mp4`))) manquants.push(`${s.id}.mp4`);
      if (!existsSync(join(racine, `${s.id}.webp`))) manquants.push(`${s.id}.webp`);
    }

    expect(manquants).toEqual([]);
  });

  it('proposent au moins un style gratuit et un style premium', () => {
    const tiers = new Set(ANIMATION_STYLES.map((s) => s.tier));
    expect(tiers.has('free')).toBe(true);
    expect(tiers.has('premium')).toBe(true);
  });

  it('n annoncent pas deux fois le meme style', () => {
    const ids = ANIMATION_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
