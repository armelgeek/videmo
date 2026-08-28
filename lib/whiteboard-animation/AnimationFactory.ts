/**
 * TypeScript wrapper for Animation Factory
 * Provides type-safe factory for creating animations
 */

import type { AnimationStyle, AnimationOptions } from './types';

// Lazy load the JavaScript factory to avoid circular dependencies
let JSAnimationFactory: any = null;

const getFactory = () => {
  if (!JSAnimationFactory) {
    try {
      // eslint-disable-next-line global-require
      const factoryModule = require('./index.js');
      JSAnimationFactory = factoryModule.AnimationFactory || factoryModule.default || factoryModule;
    } catch (error) {
      console.warn('Could not load animation factory:', error);
    }
  }
  return JSAnimationFactory;
};

export interface IAnimationFactory {
  create(styleName: AnimationStyle, options: AnimationOptions): any;
}

/**
 * Type-safe animation factory
 * Creates animation instances with proper typing
 */
class AnimationFactoryTS implements IAnimationFactory {
  /**
   * Create an animation instance
   * @param styleName - Animation style name
   * @param options - Animation configuration options
   * @returns Animation instance
   */
  create(styleName: AnimationStyle, options: AnimationOptions = {}): any {
    if (!styleName) {
      throw new Error('Animation style name is required');
    }

    try {
      const factory = getFactory();
      if (!factory || !factory.create) {
        throw new Error('Animation factory not available');
      }
      return factory.create(styleName, options);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create animation '${styleName}': ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all available animation styles
   */
  getAvailableStyles(): AnimationStyle[] {
    return [
      'scanner',
      'contour',
      'outlinechunks',
      'chunkjump',
      'outlinefill',
      'nervous',
      'topanchor',
      'scribble',
      'specialized',
      'gesture',
      'illustfill',
      'outlineonly',
      'spec-text',
      'spec-human',
      'spec-animal',
      'spec-portrait',
      'spec-vehicle',
      'spec-building',
      'spec-landscape',
      'spec-spiral',
      'spec-nature',
      'spec-explode',
    ];
  }

  /**
   * Check if a style is available
   */
  isStyleAvailable(styleName: string): boolean {
    return this.getAvailableStyles().includes(styleName as AnimationStyle);
  }
}

export const AnimationFactory = new AnimationFactoryTS();
export default AnimationFactory;
