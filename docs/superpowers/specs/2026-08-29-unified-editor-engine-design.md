# Unified Editor Engine Design Specification

**Date**: 2026-08-29  
**Status**: Design Phase  
**Epic**: Merge whiteboard and editor into single unified engine  

## Executive Summary

Currently, the application has **two separate state management systems**:
1. **Editor Engine** (`/lib/editor`) — Timeline, clips, playback control
2. **Whiteboard Animation Engine** (`/lib/whiteboard-animation`) — Animation rendering, hand drawing, annotations

This causes **state fragmentation**, making it difficult to synchronize behavior between the two subsystems (e.g., play/pause, seeking, settings). This spec unifies both into a **single `UnifiedEngineContext`** with one authoritative state and one main hook (`useUnifiedEngine`).

## Problem Statement

### Current Issues
1. **Fragmented State**: Animation state lives in `AnimationContext`, timeline state lives in `EditorContext`. Synchronizing between them is manual and error-prone.
2. **Duplicate Logic**: Both systems manage similar concerns (playback, progress, duration) independently.
3. **Component Coupling**: Components must import and coordinate between two separate contexts.
4. **Difficult to Share**: Annotations, speed settings, layer data cannot flow freely between timeline and whiteboard.

### Success Criteria
- ✅ Single source of truth for all engine state
- ✅ Seamless sync between timeline and whiteboard playback
- ✅ Components use one hook: `useUnifiedEngine()`
- ✅ No breaking changes to UI components (minimize refactoring)
- ✅ Migration is incremental and testable

## Architecture

### New Directory Structure

```
lib/
├── unified-engine/                        # NEW: Single unified engine
│   ├── core/
│   │   ├── animation-engine.ts            # Animation rendering logic
│   │   ├── timeline-engine.ts             # Timeline & clip playback
│   │   ├── layer-manager.ts               # Layer state management
│   │   ├── state-manager.ts               # Core state mutations
│   │   └── index.ts                       # Export public API
│   │
│   ├── context/
│   │   └── unified-engine-context.tsx     # Single React Context
│   │
│   ├── hooks/
│   │   ├── useUnifiedEngine.ts            # Main hook (all functionality)
│   │   └── useUnifiedEngineSelector.ts    # Atom-based selectors (optional)
│   │
│   ├── types/
│   │   └── index.ts                       # Shared type definitions
│   │
│   ├── services/
│   │   ├── whiteboard-editor-service.ts   # Whiteboard operations
│   │   ├── animation-engine-loader.ts     # Legacy engine loading
│   │   └── index.ts
│   │
│   └── README.md
│
├── editor/                                # EXISTING: UI components
│   └── components/                        # (updated to use unified-engine)
│
├── whiteboard-animation/                  # EXISTING: UI components
│   ├── components/                        # (updated to use unified-engine)
│   ├── lib/                               # Legacy JS stays here
│   └── DEPRECATION_NOTICE.md              # Points to unified-engine
│
└── storyboard/                            # EXISTING: Persistence store
```

### Unified Engine State

**File**: `lib/unified-engine/types/index.ts`

```typescript
export interface UnifiedEngineState {
  // ===== TIMELINE & PLAYBACK =====
  timeline: {
    currentTime: number;              // ms, synced with progress
    duration: number;                 // Total animation duration (ms)
    isPlaying: boolean;
    fps: number;
    clips: ClipData[];
  };

  // ===== ANIMATION & WHITEBOARD =====
  animation: {
    layers: InkplainerLayer[];
    animStyle: string;                // "chunkjump", "scribble", etc.
    handStyle: string;                // "custom1", "ghost", etc.
    revealSpeed: number;              // 0-100
    handSpeed: number;                // 0-100
    chunks: number;                   // Tile count
    canvasBg: string;                 // "#ffffff" or "black" or "none"
    useAnnotation: boolean;
    annotations: Annotation[];
    progress: number;                 // 0-100, synced with currentTime
  };

  // ===== CANVAS & RENDERING =====
  canvas: {
    width: number;
    height: number;
    aspectRatio: string;              // "16:9", "4:3", etc.
    resolution: string;               // "720p", "1080p", etc.
  };

  // ===== UI STATE =====
  ui: {
    selectedClipId: string | null;
    selectedAnnotationIndex: number | null;
    activePanel: 'timeline' | 'whiteboard' | 'inspector';
    isLoading: boolean;
    error: string | null;
  };
}

export interface UnifiedEngineActions {
  // Timeline & Playback
  setCurrentTime(time: number): void;
  setIsPlaying(playing: boolean): void;
  togglePlay(): void;
  setDuration(duration: number): void;

  // Animation Settings
  setAnimStyle(style: string): void;
  setHandStyle(style: string): void;
  setRevealSpeed(speed: number): void;
  setHandSpeed(speed: number): void;
  setChunks(count: number): void;
  setCanvasBg(color: string): void;
  setUseAnnotation(enabled: boolean): void;

  // Annotations
  updateAnnotation(index: number, data: Partial<Annotation>): void;
  addAnnotation(annotation: Annotation): void;
  removeAnnotation(id: string): void;

  // Canvas
  setCanvasSize(width: number, height: number): void;
  setAspectRatio(ratio: string): void;
  setResolution(res: string): void;

  // UI
  setSelectedClip(clipId: string | null): void;
  setSelectedAnnotation(index: number | null): void;
  setActivePanel(panel: 'timeline' | 'whiteboard' | 'inspector'): void;

  // Lifecycle
  reset(): void;
}
```

### Data Flow

```
┌─────────────────────────────────────────┐
│    UnifiedEngineContext (Zustand)       │
│  (Single source of truth for all state) │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┬──────────┐
    │                     │          │
    v                     v          v
┌──────────────┐ ┌────────────────┐ ┌──────────────┐
│ Editor UI    │ │ Whiteboard UI  │ │ Timeline UI  │
│ Components   │ │ Components     │ │ Components   │
└──────────────┘ └────────────────┘ └──────────────┘
    │                     │              │
    └─────────┬───────────┴──────────────┘
              │
    ┌─────────v──────────────┐
    │ useUnifiedEngine()     │
    │ (Main hook)           │
    └───────────────────────┘
              │
    ┌─────────v──────────────────────────┐
    │ Core Engines                       │
    │ • animation-engine.ts              │
    │ • timeline-engine.ts               │
    │ • layer-manager.ts                 │
    └────────────────────────────────────┘
```

### State Synchronization

**Key Invariant**: `currentTime` and `progress` always point to the same value.

- `currentTime` = milliseconds (external representation, used by timeline)
- `progress` = percentage 0-100 (internal, used by animation engine)

**Conversion**:
```typescript
progress = (currentTime / duration) * 100
currentTime = (progress / 100) * duration
```

When either changes, the other updates automatically via `setCurrentTime()` or internal progress updates.

## Migration Strategy

### Phase 1: Core Infrastructure (Week 1)
- Create `/lib/unified-engine/core`, `/context`, `/hooks`, `/types`
- Implement `UnifiedEngineContext` using Zustand
- Create basic `useUnifiedEngine()` hook (wrapper initially)
- Write unit tests for state transitions

### Phase 2: Whiteboard Components (Week 2)
- Create wrapper layer around legacy animation libs
- Migrate `whiteboard-canvas.tsx`, `whiteboard-editor-step.tsx`
- Migrate `useInkplainerEngine` → `useUnifiedEngine`
- Test whiteboard functionality end-to-end

### Phase 3: Timeline & Editor Components (Week 3)
- Migrate `timeline-clip.tsx`, `timeline-storyboard.tsx`
- Merge playback control logic
- Synchronize timeline seeking with animation progress

### Phase 4: Full Integration (Week 4)
- Migrate remaining components (sidebar, inspector, settings)
- Remove old contexts (`AnimationContext`, separate `EditorContext`)
- Delete deprecated files
- Performance testing & optimization

### Phase 5: Cleanup (Ongoing)
- Legacy JS code stays in place (wrapped via engine)
- Gradually convert to TypeScript as needed
- Update documentation

## Implementation Notes

### State Management Choice: Zustand

**Why Zustand over Context?**
- Performance: Atomic updates, subscribers only re-render what they use
- Simplicity: Easier to reason about state mutations
- Dev tools: Better debugging, time-travel

**Example**:
```typescript
// lib/unified-engine/context/unified-engine-context.tsx
import { create } from 'zustand';

export const useUnifiedEngineStore = create<UnifiedEngineState & UnifiedEngineActions>((set) => ({
  timeline: { currentTime: 0, duration: 0, isPlaying: false, fps: 60, clips: [] },
  animation: { /* ... */ },
  canvas: { /* ... */ },
  ui: { /* ... */ },

  setCurrentTime: (time) => set((state) => ({
    timeline: { ...state.timeline, currentTime: time },
    animation: { ...state.animation, progress: (time / state.timeline.duration) * 100 }
  })),

  // ... other actions
}));
```

### Wrapping Legacy Code

The legacy JS libraries (`AnimationFactory`, `Timeline.js`, etc.) remain in `/lib/whiteboard-animation/lib/`. They're wrapped via:

```typescript
// lib/unified-engine/core/animation-engine.ts
import { AnimationFactory } from '@/lib/whiteboard-animation/lib/index';

export class AnimationEngine {
  private legacyAnimInstance: any;

  create(style: string, state: EngineState) {
    this.legacyAnimInstance = AnimationFactory.create(style, {
      state: this.normalizeState(state),
      ctx: state.ctx,
      // ... pass unified state
    });
  }

  private normalizeState(state: UnifiedEngineState): LegacyEngineState {
    // Transform our state into what the legacy engine expects
  }
}
```

### Testing Strategy

- **Unit tests** for state mutations (Zustand store)
- **Integration tests** for timeline ↔ whiteboard sync
- **Component tests** for UI changes (whiteboard-canvas, timeline-clip)
- **End-to-end** tests for user workflows (play, seek, change settings)

## Risk Mitigation

| Risk | Probability | Severity | Mitigation |
|------|------------|----------|-----------|
| State sync bugs (timeline ↔ animation) | Medium | High | Thorough integration testing, invariant checks |
| Performance regression from state changes | Medium | Medium | Use Zustand selectors, avoid over-subscribing |
| Breaking changes in UI components | Low | Medium | Incremental migration, feature-flag during transition |
| Legacy code incompatibilities | Medium | Low | Wrapper layer isolates legacy, gradual refactor |

## Success Metrics

- ✅ All components use `useUnifiedEngine()` exclusively
- ✅ Zero manual state synchronization in components
- ✅ Timeline and whiteboard playback perfectly synced
- ✅ No performance regression (animation frame rate ≥ 60fps)
- ✅ All existing tests pass
- ✅ Code coverage ≥ 80% for unified-engine

## Open Questions / TBD

- Should we use Zustand or Jotai for state? (Recommendation: Zustand for simplicity)
- How to handle undo/redo with unified state? (Out of scope for MVP, address later)
- Should legacy JS be gradually converted to TS? (Incremental, not blocking)

## References

- Current editor: `/lib/editor`
- Current whiteboard: `/lib/whiteboard-animation`
- Storyboard store: `/lib/storyboard/store`
- Animation context: `/lib/whiteboard-animation/context/animation-context.tsx`
