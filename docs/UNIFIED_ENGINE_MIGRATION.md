# Unified Engine Migration Guide

## Overview

The whiteboard animation engine and editor timeline have been unified into a single state management system using Zustand. This eliminates state fragmentation and ensures seamless synchronization between playback, animation, and UI state.

## Architecture

### Before (Fragmented)
```
┌─────────────────────┐        ┌──────────────────────┐
│  Editor Context     │        │ Animation Context    │
│  (timeline state)   │        │ (animation state)    │
│  - currentTime      │        │ - animStyle          │
│  - isPlaying        │        │ - progress           │
│  - duration         │        │ - annotations        │
│  - clips            │        │ - revealSpeed        │
└─────────────────────┘        └──────────────────────┘
         ▲                               ▲
         │ Manual sync (error-prone)    │
         │◄──────────────────────────────│
```

### After (Unified)
```
┌──────────────────────────────────────────────────┐
│   UnifiedEngineContext (Zustand)                 │
│   Single source of truth for all state           │
│                                                   │
│  timeline: { currentTime, duration, clips, ... } │
│  animation: { animStyle, speed, annotations }   │
│  canvas: { width, height, aspectRatio, ... }    │
│  ui: { selectedClip, activePanel, ... }         │
└──────────────────────────────────────────────────┘
         ▲
         │ useUnifiedEngine hook
         │
    ┌────┴─────┬─────────┬──────────┐
    │           │         │          │
Editor UI    Whiteboard  Timeline   Other
Components   Components  Components Components
```

## Usage

### Basic Usage

```typescript
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';

export function MyComponent() {
  const { 
    currentTime, 
    isPlaying, 
    progress,
    animStyle,
    togglePlay,
    setCurrentTime,
    setAnimStyle,
  } = useUnifiedEngine();

  return (
    <div>
      <p>Progress: {progress}%</p>
      <button onClick={togglePlay}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
    </div>
  );
}
```

### Using Selectors for Performance

For components that only need specific state properties, use selectors to avoid unnecessary re-renders:

```typescript
import { useUnifiedEngine, selectProgress, selectIsPlaying } from '@/lib/unified-engine/hooks';

export function SmallComponent() {
  // Only re-renders when progress or isPlaying changes
  const progress = useUnifiedEngine(selectProgress);
  const isPlaying = useUnifiedEngine(selectIsPlaying);

  return <div>{progress}%</div>;
}
```

## State Structure

### Timeline State
- `currentTime` (number): Current playback position in milliseconds
- `duration` (number): Total animation duration in milliseconds
- `isPlaying` (boolean): Whether animation is currently playing
- `fps` (number): Frames per second for playback
- `clips` (ClipData[]): Timeline clips

### Animation State
- `animStyle` (string): Animation rendering style ("chunkjump", "scribble", etc.)
- `handStyle` (string): Hand cursor style ("custom1", "ghost", etc.)
- `revealSpeed` (number): Animation reveal speed (0-100)
- `handSpeed` (number): Hand animation speed (0-100)
- `chunks` (number): Number of animation tiles
- `canvasBg` (string): Canvas background color
- `useAnnotation` (boolean): Whether to show annotations
- `annotations` (Annotation[]): Annotation regions and timing
- `layers` (InkplainerLayer[]): Drawable layers

### Canvas State
- `width` (number): Canvas width in pixels
- `height` (number): Canvas height in pixels
- `aspectRatio` (string): Display aspect ratio ("16:9", "4:3", etc.)
- `resolution` (string): Resolution preset ("720p", "1080p", etc.)

### UI State
- `selectedClipId` (string | null): Currently selected clip ID
- `selectedAnnotationIndex` (number | null): Currently selected annotation index
- `activePanel` ('timeline' | 'whiteboard' | 'inspector'): Active sidebar panel
- `isLoading` (boolean): Loading indicator state
- `error` (string | null): Error message if any

## Action Methods

### Playback Control
```typescript
setCurrentTime(time: number)    // Set playback position (clamped to duration)
setIsPlaying(playing: boolean)  // Play or pause
togglePlay()                    // Toggle play/pause
setDuration(duration: number)   // Set total duration
```

### Animation Settings
```typescript
setAnimStyle(style: string)     // Change animation style
setHandStyle(style: string)     // Change hand cursor style
setRevealSpeed(speed: number)   // Set reveal speed (0-100)
setHandSpeed(speed: number)     // Set hand speed (0-100)
setChunks(count: number)        // Set tile count
setCanvasBg(color: string)      // Set background color
setUseAnnotation(enabled: boolean) // Toggle annotations
```

### Annotation Management
```typescript
addAnnotation(annotation: Annotation)
updateAnnotation(index: number, data: Partial<Annotation>)
removeAnnotation(id: string)
```

### Layer Management
```typescript
addLayer(layer: InkplainerLayer)
updateLayer(id: string, data: Partial<InkplainerLayer>)
removeLayer(id: string)
```

## Migration Checklist

- [x] Create Zustand store with all state
- [x] Implement selectors for fine-grained subscriptions
- [x] Create main `useUnifiedEngine` hook
- [x] Migrate whiteboard components
- [x] Delete old contexts and hooks
- [x] Add synchronization with editor playback
- [x] Add unit and integration tests
- [ ] Complete Phase 3 playback sync (has infinite loop issue)
- [ ] Performance optimization
- [ ] Production deployment

## Known Issues

### Infinite Loop in Editor Sync (Task 3.1)
The bidirectional synchronization between editor playback and unified engine causes an infinite loop. **Workaround**: Use a ref-based approach or one-way sync pattern.

**Status**: Marked as "needs redesign"

## Performance Considerations

- **Selector Usage**: Use named selectors instead of reading the whole store to avoid unnecessary re-renders
- **Batch Updates**: Multiple related updates in an `act()` block improve performance
- **Memoization**: Components using the hook should memoize callbacks to avoid re-renders

## Adding New State

To add new state to the unified engine:

1. Add to `UnifiedEngineState` in `lib/unified-engine/types/index.ts`
2. Add mutation methods to `UnifiedEngineActions` interface
3. Implement mutations in `lib/unified-engine/context/unified-engine-context.tsx`
4. Export selector in `lib/unified-engine/hooks/selectors.ts`
5. Add to default return in `useUnifiedEngine()` hook if commonly used

## Testing

Unit tests exist for:
- LayerManager operations
- Store mutations
- Progress calculation
- Annotation management
- Canvas size changes

Integration tests verify:
- Timeline/animation sync
- State persistence across play cycles
- Performance under heavy load

Run tests with: `npm test` (when Jest is configured)

## Related Files

- Spec: `docs/superpowers/specs/2026-08-29-unified-editor-engine-design.md`
- Implementation Plan: `docs/superpowers/plans/2026-08-29-unified-editor-engine-implementation.md`
- Engine Source: `lib/unified-engine/`
- Deprecated APIs: `lib/whiteboard-animation/DEPRECATION_NOTICE.md`
