// Export types
export type {
  AnimationStyle,
  AnimationOptions,
  WhiteboardState,
  WhiteboardLayer,
  WhiteboardProject,
  DrawingPath,
  EditorEngineConfig,
  TimelineConfig,
} from './types';

// Export hooks
export { useWhiteboard, defaultWhiteboardState } from './hooks/use-whiteboard';
export type { UseWhiteboardProps } from './hooks/use-whiteboard';

// Export components
export { WhiteboardCanvas } from './components/whiteboard-canvas';
export { WhiteboardSettings } from './components/whiteboard-settings';
export { WhiteboardEditorPanel } from './components/whiteboard-editor-panel';

// Export services
export { WhiteboardEditorService } from './services/whiteboard-editor-service';

// Export TypeScript wrappers for animation system
export { AnimationFactory } from './AnimationFactory';
export type { IAnimationFactory } from './AnimationFactory';

export { Animation } from './Animation';
export { EditorEngine } from './EditorEngine';
export type { EditorEngineConfig as EditorEngineConfigInterface, EditorEngineInterface } from './EditorEngine';

export { Timeline } from './Timeline';
export type { TimelineConfig as TimelineConfigInterface, TimelineState, TimelineHooks } from './Timeline';

// Re-export animation factory from original lib for compatibility
export { default as JSAnimationFactory } from './index.js';
