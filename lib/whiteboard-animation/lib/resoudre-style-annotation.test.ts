import { describe, expect, it } from 'vitest';
import { AnnotationSchema } from '../schema';

const { resoudreStyleAnnotation } = require('./resoudre-style-annotation');

describe('resoudreStyleAnnotation', () => {
  it('AC-1: resout en spec-text pour les roles textuels', () => {
    expect(resoudreStyleAnnotation({ role: 'title' })).toBe('spec-text');
    expect(resoudreStyleAnnotation({ role: 'text' })).toBe('spec-text');
    expect(resoudreStyleAnnotation({ role: 'label' })).toBe('spec-text');
    expect(resoudreStyleAnnotation({ text: 'Bonjour le monde' })).toBe('spec-text');
  });

  it('AC-2: resout en gesture pour les fleches', () => {
    expect(resoudreStyleAnnotation({ role: 'arrow' })).toBe('gesture');
    expect(resoudreStyleAnnotation({ object: 'red arrow pointing right' })).toBe('gesture');
    expect(resoudreStyleAnnotation({ object: 'flèche vers le total' })).toBe('gesture');
  });

  it('AC-3: resout en brushfill pour les remplissages et contour pour les conteneurs', () => {
    expect(resoudreStyleAnnotation({ revealType: 'fill' })).toBe('brushfill');
    expect(resoudreStyleAnnotation({ role: 'container', revealType: 'fill' })).toBe('brushfill');
    expect(resoudreStyleAnnotation({ role: 'container' })).toBe('contour');
    expect(resoudreStyleAnnotation({ role: 'shape' })).toBe('contour');
  });

  it('AC-4: respecte le style explicite en priorite', () => {
    expect(resoudreStyleAnnotation({ role: 'title', animStyle: 'scribble' })).toBe('scribble');
    expect(resoudreStyleAnnotation({ role: 'arrow', animStyle: 'contour' })).toBe('contour');
    expect(resoudreStyleAnnotation({ role: 'title', animStyle: 'auto' })).toBe('spec-text');
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
    expect(resoudreStyleAnnotation({})).toBe('chunkjump');
    expect(resoudreStyleAnnotation({}, 'scanner')).toBe('scanner');
    expect(resoudreStyleAnnotation({ role: 'drawing' }, 'scanner')).toBe('scanner');
  });
});
