/**
 * TypeScript wrapper for Editor Engine
 * Provides type-safe access to the drawing and animation engine
 */

import type { WhiteboardState } from './types';

export interface EditorEngineConfig {
  canvas: HTMLCanvasElement;
  handCanvas: HTMLCanvasElement;
  selCanvas: HTMLCanvasElement;
  state: WhiteboardState;
  options?: Record<string, any>;
  hooks?: Record<string, any>;
}

export interface EditorEngineInterface {
  state: WhiteboardState;
  render(): void;
  update(deltaTime: number): void;
  dispose(): void;
}

/**
 * Type-safe wrapper for the Editor Engine
 * Manages rendering and animation playback
 */
export class EditorEngine implements EditorEngineInterface {
  private jsEngine: any;
  public state: WhiteboardState;

  constructor(config: EditorEngineConfig) {
    if (!config.canvas) {
      throw new Error('Canvas element is required');
    }
    if (!config.state) {
      throw new Error('State object is required');
    }

    this.state = config.state;

    try {
      // Load JavaScript engine
      const engineModule = require('./editor/EditorEngine.js');
      const createEngine = engineModule.default || engineModule.createEditorEngine || engineModule;

      if (typeof createEngine === 'function') {
        this.jsEngine = createEngine(config);
      } else {
        this.jsEngine = engineModule;
      }
    } catch (error) {
      console.warn('EditorEngine not loaded:', error);
    }
  }

  /**
   * Render current frame
   */
  render(): void {
    if (this.jsEngine?.render) {
      this.jsEngine.render();
    }
  }

  /**
   * Update engine state
   */
  update(deltaTime: number): void {
    if (this.jsEngine?.update) {
      this.jsEngine.update(deltaTime);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.jsEngine?.dispose) {
      this.jsEngine.dispose();
    }
  }

  /**
   * Get raw JavaScript engine if needed
   */
  getRawEngine(): any {
    return this.jsEngine;
  }
}

export default EditorEngine;
