/**
 * Whiteboard Animation Library - Main Export
 * Re-exports all components, hooks, services, and types
 */

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
export { WhiteboardSidebarPanel } from './components/whiteboard-sidebar-panel';

// Export services
export { WhiteboardEditorService } from './services/whiteboard-editor-service';

// Export TypeScript wrappers for animation system
export { AnimationFactory } from './AnimationFactory';
export type { IAnimationFactory } from './AnimationFactory';
