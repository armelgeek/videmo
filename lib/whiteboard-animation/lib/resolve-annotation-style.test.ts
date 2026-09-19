import { describe, expect, it } from 'vitest';
import { AnnotationSchema } from '../schema';

const { resolveAnnotationStyle } = require('./resolve-annotation-style');

describe('resolveAnnotationStyle', () => {
  it('AC-1: resout en spec-text pour les roles textuels', () => {
    expect(resolveAnnotationStyle({ role: 'title' })).toBe('spec-text');
    expect(resolveAnnotationStyle({ role: 'text' })).toBe('spec-text');
    expect(resolveAnnotationStyle({ role: 'label' })).toBe('spec-text');
    expect(resolveAnnotationStyle({ text: 'Bonjour le monde' })).toBe('spec-text');
  });

  it('AC-2: resout en gesture pour les fleches', () => {
    expect(resolveAnnotationStyle({ role: 'arrow' })).toBe('gesture');
    expect(resolveAnnotationStyle({ object: 'red arrow pointing right' })).toBe('gesture');
    expect(resolveAnnotationStyle({ object: 'flèche vers le total' })).toBe('gesture');
  });

  it('AC-3: resout en brushfill pour les remplissages et contour pour les conteneurs', () => {
    expect(resolveAnnotationStyle({ revealType: 'fill' })).toBe('brushfill');
    expect(resolveAnnotationStyle({ role: 'container', revealType: 'fill' })).toBe('brushfill');
    expect(resolveAnnotationStyle({ role: 'container' })).toBe('contour');
    expect(resolveAnnotationStyle({ role: 'shape' })).toBe('contour');
  });

  it('AC-4: respecte le style explicite en priorite', () => {
    expect(resolveAnnotationStyle({ role: 'title', animStyle: 'scribble' })).toBe('scribble');
    expect(resolveAnnotationStyle({ role: 'arrow', animStyle: 'contour' })).toBe('contour');
    expect(resolveAnnotationStyle({ role: 'title', animStyle: 'auto' })).toBe('spec-text');
  });

  it('AC-5: valide la compatibilite avec AnnotationSchema Zod', () => {
    // Annotation complète avec nouveaux champs IA
    const complete = AnnotationSchema.parse({
      id: 'ai-1',
      role: 'arrow',
      object: 'green arrow',
      revealType: 'stroke',
      region: { x: 10, y: 10, width: 100, height: 50 },
    });
    expect(complete.role).toBe('arrow');
    expect(complete.object).toBe('green arrow');
    expect(complete.revealType).toBe('stroke');

    // Rétrocompatibilité : ancienne annotation sans ces champs
    const ancienne = AnnotationSchema.parse({
      id: 'legacy-1',
      region: { x: 0, y: 0, width: 50, height: 50 },
    });
    expect(ancienne.role).toBeUndefined();
    expect(ancienne.object).toBeUndefined();
    expect(ancienne.revealType).toBeUndefined();
  });

  it('replie vers le style par defaut si aucun role reconnaissable', () => {
    expect(resolveAnnotationStyle({})).toBe('chunkjump');
    expect(resolveAnnotationStyle({}, 'scanner')).toBe('scanner');
    expect(resolveAnnotationStyle({ role: 'drawing' }, 'scanner')).toBe('scanner');
  });
});
