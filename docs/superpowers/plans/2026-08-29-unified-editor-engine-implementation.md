# Unified Editor Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the separate whiteboard and editor engines into a single unified engine with shared state and synchronized playback.

**Architecture:** Create `/lib/unified-engine` with Zustand-based state management, migrating components phase-by-phase from the two separate engines. Each phase is independently testable; migration is incremental with zero breaking changes.

**Tech Stack:** React 18, TypeScript, Zustand (state), existing Animation libraries (wrapped via facade).

**Spec:** `docs/superpowers/specs/2026-08-29-unified-editor-engine-design.md`

## Global Constraints

- TypeScript strict mode enforced
- React 18+ with hooks only
- Zustand v4+ for state
- Single source of truth: `currentTime` (all progress derives from it)
- No breaking changes to existing component APIs during migration
- Legacy JS code (`/lib/whiteboard-animation/lib/`) remains wrapped, not rewritten
- All new code in `/lib/unified-engine` must be TypeScript

---

## Phase 1: Core Infrastructure

### Task 1.1: Create unified-engine directory and type definitions

**Files:**
- Create: `lib/unified-engine/types/index.ts`
- Create: `lib/unified-engine/README.md`

**Interfaces:**
- Produces: `UnifiedEngineState` interface with timeline, animation, canvas, ui subobjects
- Produces: `UnifiedEngineActions` interface with all state mutation methods

**Steps:**

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p lib/unified-engine/{core,context,hooks,services,types,serialization}
```

- [ ] **Step 2: Write type definitions**

Create `lib/unified-engine/types/index.ts`:

```typescript
// Annotation schema (mirrors Python annotation.json)
export interface Annotation {
  id: string;
  text: string;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  reveal: {
    from: number;      // ms
    to: number;        // ms
    durationMs: number;
    startMs: number;
  };
  style?: {
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    opacity?: number;
  };
}

export interface InkplainerLayer {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  visible: boolean;
  animStyle?: string;
  handStyle?: string;
  speed?: number;
  handSpeed?: number;
  imageElement?: HTMLImageElement;
}

export interface ClipData {
  id: string;
  name: string;
  startTime: number;   // ms
  duration: number;    // ms
  layerId: string;
  data: Record<string, any>;
}

export interface UnifiedEngineState {
  // ===== TIMELINE & PLAYBACK =====
  timeline: {
    currentTime: number;              // ms — single authoritative clock
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
    // progress: REMOVED — always derive from currentTime/duration
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
  setFps(fps: number): void;

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

  // Layers
  addLayer(layer: InkplainerLayer): void;
  updateLayer(id: string, data: Partial<InkplainerLayer>): void;
  removeLayer(id: string): void;

  // Canvas
  setCanvasSize(width: number, height: number): void;
  setAspectRatio(ratio: string): void;
  setResolution(res: string): void;

  // UI
  setSelectedClip(clipId: string | null): void;
  setSelectedAnnotation(index: number | null): void;
  setActivePanel(panel: 'timeline' | 'whiteboard' | 'inspector'): void;
  setError(error: string | null): void;

  // Lifecycle
  reset(): void;
}

export type UnifiedEngineStore = UnifiedEngineState & UnifiedEngineActions;
```

- [ ] **Step 3: Write README**

Create `lib/unified-engine/README.md`:

```markdown
# Unified Engine

Single source of truth for all editor state: timeline, animation, whiteboard, canvas settings.

## Usage

```typescript
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';

export function MyComponent() {
  const { currentTime, isPlaying, setCurrentTime, togglePlay } = useUnifiedEngine();
  
  return (
    <div>
      <p>Current: {currentTime}ms</p>
      <button onClick={togglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
    </div>
  );
}
```

## State Structure

See `types/index.ts` for full state shape.

## Selectors

Use named selectors instead of reading the whole store:

```typescript
const currentTime = useUnifiedEngine(selectCurrentTime);
const isPlaying = useUnifiedEngine(selectIsPlaying);
```

## Adding New State

1. Add to `UnifiedEngineState` in `types/index.ts`
2. Add mutation in `UnifiedEngineActions`
3. Implement in `context/unified-engine-context.tsx`
4. Export selector in `hooks/selectors.ts`
```

- [ ] **Step 4: Commit**

```bash
git add lib/unified-engine/
git commit -m "feat: initialize unified-engine types and structure"
```

---

### Task 1.2: Create Zustand store with initial state

**Files:**
- Create: `lib/unified-engine/context/unified-engine-context.tsx`
- Create: `lib/unified-engine/context/index.ts`

**Interfaces:**
- Consumes: `UnifiedEngineState`, `UnifiedEngineActions` from Task 1.1
- Produces: `useUnifiedEngineStore` (Zustand store hook)

**Steps:**

- [ ] **Step 1: Write Zustand store implementation**

Create `lib/unified-engine/context/unified-engine-context.tsx`:

```typescript
'use client';

import { create } from 'zustand';
import type { UnifiedEngineStore, UnifiedEngineState, Annotation, InkplainerLayer } from '../types';

const DEFAULT_CANVAS_WIDTH = 1280;
const DEFAULT_CANVAS_HEIGHT = 720;

const initialState: UnifiedEngineState = {
  timeline: {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    fps: 60,
    clips: [],
  },
  animation: {
    layers: [
      {
        id: '1',
        name: 'scene-premium-bag',
        x: 0,
        y: 0,
        w: DEFAULT_CANVAS_WIDTH,
        h: DEFAULT_CANVAS_HEIGHT,
        opacity: 1,
        visible: true,
        animStyle: 'chunkjump',
        handStyle: 'custom1',
        speed: 40,
        handSpeed: 6,
      },
    ],
    animStyle: 'chunkjump',
    handStyle: 'custom1',
    revealSpeed: 40,
    handSpeed: 6,
    chunks: 5,
    canvasBg: '#ffffff',
    useAnnotation: false,
    annotations: [],
  },
  canvas: {
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
    aspectRatio: '16:9',
    resolution: '720p',
  },
  ui: {
    selectedClipId: null,
    selectedAnnotationIndex: null,
    activePanel: 'timeline',
    isLoading: false,
    error: null,
  },
};

export const useUnifiedEngineStore = create<UnifiedEngineStore>((set, get) => ({
  ...initialState,

  // Timeline & Playback
  setCurrentTime: (time: number) => {
    set((state) => ({
      timeline: {
        ...state.timeline,
        currentTime: Math.max(0, Math.min(time, state.timeline.duration)),
      },
    }));
  },

  setIsPlaying: (playing: boolean) => {
    set((state) => ({
      timeline: { ...state.timeline, isPlaying: playing },
    }));
  },

  togglePlay: () => {
    set((state) => ({
      timeline: { ...state.timeline, isPlaying: !state.timeline.isPlaying },
    }));
  },

  setDuration: (duration: number) => {
    set((state) => ({
      timeline: {
        ...state.timeline,
        duration: Math.max(0, duration),
        currentTime: Math.min(state.timeline.currentTime, duration),
      },
    }));
  },

  setFps: (fps: number) => {
    set((state) => ({
      timeline: { ...state.timeline, fps: Math.max(1, fps) },
    }));
  },

  // Animation Settings
  setAnimStyle: (animStyle: string) => {
    set((state) => ({
      animation: { ...state.animation, animStyle },
    }));
  },

  setHandStyle: (handStyle: string) => {
    set((state) => ({
      animation: { ...state.animation, handStyle },
    }));
  },

  setRevealSpeed: (revealSpeed: number) => {
    set((state) => ({
      animation: { ...state.animation, revealSpeed: Math.max(0, Math.min(100, revealSpeed)) },
    }));
  },

  setHandSpeed: (handSpeed: number) => {
    set((state) => ({
      animation: { ...state.animation, handSpeed: Math.max(0, Math.min(100, handSpeed)) },
    }));
  },

  setChunks: (chunks: number) => {
    set((state) => ({
      animation: { ...state.animation, chunks: Math.max(1, chunks) },
    }));
  },

  setCanvasBg: (canvasBg: string) => {
    set((state) => ({
      animation: { ...state.animation, canvasBg },
    }));
  },

  setUseAnnotation: (useAnnotation: boolean) => {
    set((state) => ({
      animation: { ...state.animation, useAnnotation },
    }));
  },

  // Annotations
  updateAnnotation: (index: number, data: Partial<Annotation>) => {
    set((state) => {
      const annotations = [...state.animation.annotations];
      if (annotations[index]) {
        annotations[index] = { ...annotations[index], ...data };
      }
      return { animation: { ...state.animation, annotations } };
    });
  },

  addAnnotation: (annotation: Annotation) => {
    set((state) => ({
      animation: {
        ...state.animation,
        annotations: [...state.animation.annotations, annotation],
      },
    }));
  },

  removeAnnotation: (id: string) => {
    set((state) => ({
      animation: {
        ...state.animation,
        annotations: state.animation.annotations.filter((a) => a.id !== id),
      },
    }));
  },

  // Layers
  addLayer: (layer: InkplainerLayer) => {
    set((state) => ({
      animation: {
        ...state.animation,
        layers: [...state.animation.layers, layer],
      },
    }));
  },

  updateLayer: (id: string, data: Partial<InkplainerLayer>) => {
    set((state) => ({
      animation: {
        ...state.animation,
        layers: state.animation.layers.map((layer) =>
          layer.id === id ? { ...layer, ...data } : layer
        ),
      },
    }));
  },

  removeLayer: (id: string) => {
    set((state) => ({
      animation: {
        ...state.animation,
        layers: state.animation.layers.filter((layer) => layer.id !== id),
      },
    }));
  },

  // Canvas
  setCanvasSize: (width: number, height: number) => {
    set((state) => ({
      canvas: { ...state.canvas, width, height },
    }));
  },

  setAspectRatio: (aspectRatio: string) => {
    set((state) => ({
      canvas: { ...state.canvas, aspectRatio },
    }));
  },

  setResolution: (resolution: string) => {
    set((state) => ({
      canvas: { ...state.canvas, resolution },
    }));
  },

  // UI
  setSelectedClip: (selectedClipId: string | null) => {
    set((state) => ({
      ui: { ...state.ui, selectedClipId },
    }));
  },

  setSelectedAnnotation: (selectedAnnotationIndex: number | null) => {
    set((state) => ({
      ui: { ...state.ui, selectedAnnotationIndex },
    }));
  },

  setActivePanel: (activePanel: 'timeline' | 'whiteboard' | 'inspector') => {
    set((state) => ({
      ui: { ...state.ui, activePanel },
    }));
  },

  setError: (error: string | null) => {
    set((state) => ({
      ui: { ...state.ui, error },
    }));
  },

  // Lifecycle
  reset: () => {
    set(initialState);
  },
}));
```

- [ ] **Step 2: Create index export**

Create `lib/unified-engine/context/index.ts`:

```typescript
export { useUnifiedEngineStore } from './unified-engine-context';
```

- [ ] **Step 3: Commit**

```bash
git add lib/unified-engine/context/
git commit -m "feat: create zustand store for unified engine"
```

---

### Task 1.3: Create selectors for fine-grained subscriptions

**Files:**
- Create: `lib/unified-engine/hooks/selectors.ts`

**Interfaces:**
- Consumes: `UnifiedEngineStore` type from Task 1.2
- Produces: Named selector functions (e.g., `selectCurrentTime`, `selectIsPlaying`, etc.)

**Steps:**

- [ ] **Step 1: Write selectors**

Create `lib/unified-engine/hooks/selectors.ts`:

```typescript
import type { UnifiedEngineState } from '../types';

// Timeline Selectors
export const selectCurrentTime = (state: UnifiedEngineState) => state.timeline.currentTime;
export const selectDuration = (state: UnifiedEngineState) => state.timeline.duration;
export const selectIsPlaying = (state: UnifiedEngineState) => state.timeline.isPlaying;
export const selectFps = (state: UnifiedEngineState) => state.timeline.fps;
export const selectClips = (state: UnifiedEngineState) => state.timeline.clips;

// Derived: Progress percentage
export const selectProgress = (state: UnifiedEngineState) => 
  state.timeline.duration > 0 
    ? (state.timeline.currentTime / state.timeline.duration) * 100 
    : 0;

// Derived: Remaining time
export const selectRemainingTime = (state: UnifiedEngineState) =>
  state.timeline.duration - state.timeline.currentTime;

// Animation Selectors
export const selectAnimStyle = (state: UnifiedEngineState) => state.animation.animStyle;
export const selectHandStyle = (state: UnifiedEngineState) => state.animation.handStyle;
export const selectRevealSpeed = (state: UnifiedEngineState) => state.animation.revealSpeed;
export const selectHandSpeed = (state: UnifiedEngineState) => state.animation.handSpeed;
export const selectChunks = (state: UnifiedEngineState) => state.animation.chunks;
export const selectCanvasBg = (state: UnifiedEngineState) => state.animation.canvasBg;
export const selectUseAnnotation = (state: UnifiedEngineState) => state.animation.useAnnotation;
export const selectAnnotations = (state: UnifiedEngineState) => state.animation.annotations;
export const selectLayers = (state: UnifiedEngineState) => state.animation.layers;

// Canvas Selectors
export const selectCanvasWidth = (state: UnifiedEngineState) => state.canvas.width;
export const selectCanvasHeight = (state: UnifiedEngineState) => state.canvas.height;
export const selectAspectRatio = (state: UnifiedEngineState) => state.canvas.aspectRatio;
export const selectResolution = (state: UnifiedEngineState) => state.canvas.resolution;

// UI Selectors
export const selectSelectedClipId = (state: UnifiedEngineState) => state.ui.selectedClipId;
export const selectSelectedAnnotationIndex = (state: UnifiedEngineState) => state.ui.selectedAnnotationIndex;
export const selectActivePanel = (state: UnifiedEngineState) => state.ui.activePanel;
export const selectError = (state: UnifiedEngineState) => state.ui.error;
```

- [ ] **Step 2: Commit**

```bash
git add lib/unified-engine/hooks/selectors.ts
git commit -m "feat: add fine-grained selectors for unified engine"
```

---

### Task 1.4: Create main useUnifiedEngine hook

**Files:**
- Create: `lib/unified-engine/hooks/useUnifiedEngine.ts`
- Create: `lib/unified-engine/hooks/index.ts`

**Interfaces:**
- Consumes: `useUnifiedEngineStore` from Task 1.2, selectors from Task 1.3
- Produces: `useUnifiedEngine` hook that provides both state and actions

**Steps:**

- [ ] **Step 1: Write main hook**

Create `lib/unified-engine/hooks/useUnifiedEngine.ts`:

```typescript
'use client';

import { useCallback } from 'react';
import { useUnifiedEngineStore } from '../context';
import * as selectors from './selectors';
import type { UnifiedEngineState } from '../types';

type Selector = (state: UnifiedEngineState) => any;

export function useUnifiedEngine<T = UnifiedEngineState>(selector?: Selector): T {
  if (selector) {
    return useUnifiedEngineStore(selector);
  }
  
  // No selector: return a stable object with commonly used selectors + all actions
  return useUnifiedEngineStore((state) => ({
    // Most common timeline state
    currentTime: selectors.selectCurrentTime(state),
    duration: selectors.selectDuration(state),
    isPlaying: selectors.selectIsPlaying(state),
    progress: selectors.selectProgress(state),
    fps: selectors.selectFps(state),

    // Most common animation state
    animStyle: selectors.selectAnimStyle(state),
    handStyle: selectors.selectHandStyle(state),
    revealSpeed: selectors.selectRevealSpeed(state),
    handSpeed: selectors.selectHandSpeed(state),
    chunks: selectors.selectChunks(state),
    canvasBg: selectors.selectCanvasBg(state),
    useAnnotation: selectors.selectUseAnnotation(state),
    annotations: selectors.selectAnnotations(state),
    layers: selectors.selectLayers(state),

    // Canvas
    canvasWidth: selectors.selectCanvasWidth(state),
    canvasHeight: selectors.selectCanvasHeight(state),
    aspectRatio: selectors.selectAspectRatio(state),

    // UI
    activePanel: selectors.selectActivePanel(state),
    selectedAnnotationIndex: selectors.selectSelectedAnnotationIndex(state),

    // All actions
    setCurrentTime: state.setCurrentTime,
    setIsPlaying: state.setIsPlaying,
    togglePlay: state.togglePlay,
    setDuration: state.setDuration,
    setFps: state.setFps,
    setAnimStyle: state.setAnimStyle,
    setHandStyle: state.setHandStyle,
    setRevealSpeed: state.setRevealSpeed,
    setHandSpeed: state.setHandSpeed,
    setChunks: state.setChunks,
    setCanvasBg: state.setCanvasBg,
    setUseAnnotation: state.setUseAnnotation,
    updateAnnotation: state.updateAnnotation,
    addAnnotation: state.addAnnotation,
    removeAnnotation: state.removeAnnotation,
    addLayer: state.addLayer,
    updateLayer: state.updateLayer,
    removeLayer: state.removeLayer,
    setCanvasSize: state.setCanvasSize,
    setAspectRatio: state.setAspectRatio,
    setResolution: state.setResolution,
    setSelectedClip: state.setSelectedClip,
    setSelectedAnnotation: state.setSelectedAnnotation,
    setActivePanel: state.setActivePanel,
    setError: state.setError,
    reset: state.reset,
  })) as T;
}
```

- [ ] **Step 2: Create hook index**

Create `lib/unified-engine/hooks/index.ts`:

```typescript
export { useUnifiedEngine } from './useUnifiedEngine';
export * from './selectors';
```

- [ ] **Step 3: Commit**

```bash
git add lib/unified-engine/hooks/
git commit -m "feat: add useUnifiedEngine hook with selectors"
```

---

### Task 1.5: Create core layer manager

**Files:**
- Create: `lib/unified-engine/core/layer-manager.ts`

**Interfaces:**
- Consumes: `InkplainerLayer` type from Task 1.1
- Produces: `LayerManager` class with methods: `addLayer`, `updateLayer`, `removeLayer`, `getLayer`, `getLayers`, `clearLayers`

**Steps:**

- [ ] **Step 1: Write LayerManager**

Create `lib/unified-engine/core/layer-manager.ts`:

```typescript
import type { InkplainerLayer } from '../types';

export class LayerManager {
  private layers: InkplainerLayer[];

  constructor(initialLayers: InkplainerLayer[] = []) {
    this.layers = [...initialLayers];
  }

  addLayer(layer: InkplainerLayer): InkplainerLayer {
    this.layers.push(layer);
    return layer;
  }

  updateLayer(id: string, data: Partial<InkplainerLayer>): InkplainerLayer | null {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return null;
    Object.assign(layer, data);
    return layer;
  }

  removeLayer(id: string): boolean {
    const index = this.layers.findIndex((l) => l.id === id);
    if (index === -1) return false;
    this.layers.splice(index, 1);
    return true;
  }

  getLayer(id: string): InkplainerLayer | null {
    return this.layers.find((l) => l.id === id) || null;
  }

  getLayers(): InkplainerLayer[] {
    return [...this.layers];
  }

  clearLayers(): void {
    this.layers = [];
  }

  clone(): LayerManager {
    return new LayerManager([...this.layers]);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/unified-engine/core/layer-manager.ts
git commit -m "feat: add LayerManager for layer state"
```

---

### Task 1.6: Create core index and unit tests

**Files:**
- Create: `lib/unified-engine/core/index.ts`
- Create: `__tests__/lib/unified-engine/core/layer-manager.test.ts`
- Create: `__tests__/lib/unified-engine/context/store.test.ts`

**Interfaces:**
- Consumes: LayerManager from Task 1.5, store from Task 1.2
- Produces: Test suites verifying state mutations and layer operations

**Steps:**

- [ ] **Step 1: Create core index**

Create `lib/unified-engine/core/index.ts`:

```typescript
export { LayerManager } from './layer-manager';
```

- [ ] **Step 2: Write layer manager tests**

Create `__tests__/lib/unified-engine/core/layer-manager.test.ts`:

```typescript
import { LayerManager } from '@/lib/unified-engine/core/layer-manager';
import type { InkplainerLayer } from '@/lib/unified-engine/types';

describe('LayerManager', () => {
  let manager: LayerManager;

  beforeEach(() => {
    manager = new LayerManager();
  });

  test('adds a layer', () => {
    const layer: InkplainerLayer = {
      id: '1',
      name: 'test',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      opacity: 1,
      visible: true,
    };

    manager.addLayer(layer);
    expect(manager.getLayers()).toHaveLength(1);
    expect(manager.getLayer('1')).toEqual(layer);
  });

  test('updates a layer', () => {
    const layer: InkplainerLayer = {
      id: '1',
      name: 'test',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      opacity: 1,
      visible: true,
    };

    manager.addLayer(layer);
    const updated = manager.updateLayer('1', { opacity: 0.5 });
    expect(updated?.opacity).toBe(0.5);
  });

  test('removes a layer', () => {
    const layer: InkplainerLayer = {
      id: '1',
      name: 'test',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      opacity: 1,
      visible: true,
    };

    manager.addLayer(layer);
    expect(manager.getLayers()).toHaveLength(1);
    const removed = manager.removeLayer('1');
    expect(removed).toBe(true);
    expect(manager.getLayers()).toHaveLength(0);
  });

  test('returns null for non-existent layer', () => {
    expect(manager.getLayer('nonexistent')).toBeNull();
  });
});
```

- [ ] **Step 3: Write store tests**

Create `__tests__/lib/unified-engine/context/store.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useUnifiedEngineStore } from '@/lib/unified-engine/context';

describe('UnifiedEngineStore', () => {
  beforeEach(() => {
    useUnifiedEngineStore.setState({
      timeline: {
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        fps: 60,
        clips: [],
      },
      animation: {
        layers: [],
        animStyle: 'chunkjump',
        handStyle: 'custom1',
        revealSpeed: 40,
        handSpeed: 6,
        chunks: 5,
        canvasBg: '#ffffff',
        useAnnotation: false,
        annotations: [],
      },
      canvas: {
        width: 1280,
        height: 720,
        aspectRatio: '16:9',
        resolution: '720p',
      },
      ui: {
        selectedClipId: null,
        selectedAnnotationIndex: null,
        activePanel: 'timeline',
        isLoading: false,
        error: null,
      },
    });
  });

  test('sets current time', () => {
    const { result } = renderHook(() => useUnifiedEngineStore());
    
    act(() => {
      result.current.setCurrentTime(1000);
    });

    expect(result.current.timeline.currentTime).toBe(1000);
  });

  test('clamps current time to duration', () => {
    const { result } = renderHook(() => useUnifiedEngineStore());
    
    act(() => {
      result.current.setDuration(5000);
      result.current.setCurrentTime(10000);
    });

    expect(result.current.timeline.currentTime).toBe(5000);
  });

  test('toggles play state', () => {
    const { result } = renderHook(() => useUnifiedEngineStore());
    
    expect(result.current.timeline.isPlaying).toBe(false);
    
    act(() => {
      result.current.togglePlay();
    });

    expect(result.current.timeline.isPlaying).toBe(true);
  });

  test('adds annotation', () => {
    const { result } = renderHook(() => useUnifiedEngineStore());
    
    act(() => {
      result.current.addAnnotation({
        id: 'annot-1',
        text: 'Test',
        region: { x: 0, y: 0, width: 100, height: 100 },
        reveal: { from: 0, to: 1000, durationMs: 1000, startMs: 0 },
      });
    });

    expect(result.current.animation.annotations).toHaveLength(1);
  });

  test('resets state', () => {
    const { result } = renderHook(() => useUnifiedEngineStore());
    
    act(() => {
      result.current.setCurrentTime(5000);
      result.current.setIsPlaying(true);
      result.current.reset();
    });

    expect(result.current.timeline.currentTime).toBe(0);
    expect(result.current.timeline.isPlaying).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/lib/unified-engine/
```

Expected output: All tests pass (✓)

- [ ] **Step 5: Commit**

```bash
git add lib/unified-engine/core/ __tests__/lib/unified-engine/
git commit -m "test: add unit tests for core and store"
```

---

## Phase 2: Whiteboard Components Migration

### Task 2.1: Create animation engine wrapper for legacy libs

**Files:**
- Create: `lib/unified-engine/core/animation-engine.ts`

**Interfaces:**
- Consumes: `useUnifiedEngineStore`, legacy AnimationFactory from `/lib/whiteboard-animation/lib`
- Produces: `AnimationEngine` class wrapping legacy renderer

**Steps:**

- [ ] **Step 1: Write AnimationEngine wrapper**

Create `lib/unified-engine/core/animation-engine.ts`:

```typescript
import type { UnifiedEngineState } from '../types';

// Import legacy animation libs
const AnimationFactory = require('@/lib/whiteboard-animation/lib/index');
const { CUSTOM_HANDS } = require('@/lib/whiteboard-animation/lib/hands');
const { handDrawRect } = require('@/lib/whiteboard-animation/lib/handLayout');

export interface AnimationEngineConfig {
  state: UnifiedEngineState;
  ctx: CanvasRenderingContext2D;
  hctx: CanvasRenderingContext2D;
  offscreen: HTMLCanvasElement;
  callbacks?: {
    fillBg?: () => void;
    drawHand?: (tipX: number, tipY: number) => void;
    setProgress?: (progress: number) => void;
    finishAnim?: () => void;
    resScale?: () => number;
    resPointScale?: () => number;
  };
}

export class AnimationEngine {
  private legacyInstance: any = null;
  private currentStyle: string = '';

  create(style: string, config: AnimationEngineConfig) {
    this.currentStyle = style;

    const engineState = {
      canvasW: config.state.canvas.width,
      canvasH: config.state.canvas.height,
      speed: config.state.animation.revealSpeed,
      handSpeed: config.state.animation.handSpeed,
      hand: config.state.animation.handStyle,
      tileSlider: config.state.animation.chunks,
      contentBounds: {
        x: config.state.animation.layers[0]?.x ?? 0,
        y: config.state.animation.layers[0]?.y ?? 0,
        w: config.state.animation.layers[0]?.w ?? config.state.canvas.width,
        h: config.state.animation.layers[0]?.h ?? config.state.canvas.height,
      },
      annotations: config.state.animation.useAnnotation ? config.state.animation.annotations : [],
    };

    try {
      this.legacyInstance = AnimationFactory.create(style, {
        state: engineState,
        ctx: config.ctx,
        hctx: config.hctx,
        offscreen: config.offscreen,
        callbacks: config.callbacks || {},
      });

      return this.legacyInstance;
    } catch (err) {
      console.error('Error creating animation instance:', err);
      throw err;
    }
  }

  tick(speed: number, deltaMs: number) {
    if (this.legacyInstance && this.legacyInstance.tick) {
      this.legacyInstance.tick(speed, deltaMs);
    }
  }

  setup() {
    if (this.legacyInstance && this.legacyInstance.setup) {
      this.legacyInstance.setup();
    }
  }

  destroy() {
    this.legacyInstance = null;
    this.currentStyle = '';
  }
}

export { CUSTOM_HANDS, handDrawRect };
```

- [ ] **Step 2: Commit**

```bash
git add lib/unified-engine/core/animation-engine.ts
git commit -m "feat: add AnimationEngine wrapper for legacy libs"
```

---

### Task 2.2: Migrate whiteboard-canvas component

**Files:**
- Modify: `lib/whiteboard-animation/components/whiteboard-canvas.tsx` (update imports)

**Interfaces:**
- Consumes: `useUnifiedEngine` from Task 1.4
- Produces: Updated component using unified state

**Steps:**

- [ ] **Step 1: Check current implementation**

```bash
head -50 lib/whiteboard-animation/components/whiteboard-canvas.tsx
```

- [ ] **Step 2: Update imports**

In `lib/whiteboard-animation/components/whiteboard-canvas.tsx`, replace the old context imports:

**Before:**
```typescript
import { useInkplainerEngine } from '../hooks/use-inkplainer-engine';
import { useAnimationContext } from '../context/animation-context';
```

**After:**
```typescript
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';
```

- [ ] **Step 3: Update component to use unified engine**

Replace the hook call. For example, if the old code was:

```typescript
const { isPlaying, progress } = useInkplainerEngine({ canvasRef, ... });
```

Change to:

```typescript
const { isPlaying, progress, togglePlay, resetAnimation } = useUnifiedEngine();
```

- [ ] **Step 4: Update all local usages**

Ensure all state reads/writes in the component now use the unified engine methods. Example transformations:

| Old | New |
|-----|-----|
| `useAnimationContext().setAnimStyle()` | `useUnifiedEngine().setAnimStyle()` |
| `progress` from old hook | `progress` from `useUnifiedEngine()` |
| `isPlaying` from old hook | `isPlaying` from `useUnifiedEngine()` |

- [ ] **Step 5: Test whiteboard canvas**

```bash
npm run dev
# Navigate to editor, open whiteboard section
# Verify canvas renders and plays animations
```

- [ ] **Step 6: Commit**

```bash
git add lib/whiteboard-animation/components/whiteboard-canvas.tsx
git commit -m "refactor: migrate whiteboard-canvas to unified engine"
```

---

### Task 2.3: Migrate remaining whiteboard components

**Files:**
- Modify: `lib/whiteboard-animation/components/whiteboard-editor-step.tsx`
- Modify: `lib/whiteboard-animation/components/whiteboard-sidebar-panel.tsx`
- Modify: `lib/whiteboard-animation/components/whiteboard-config-panel.tsx`
- Modify: `lib/whiteboard-animation/components/inkplainer-*.tsx` (all remaining)

**Interfaces:**
- Consumes: `useUnifiedEngine` from Task 1.4
- Produces: All whiteboard components migrated to unified state

**Steps:**

- [ ] **Step 1: Identify all whiteboard component files**

```bash
find lib/whiteboard-animation/components -name "*.tsx" -type f
```

- [ ] **Step 2: For each component, replace imports and hooks**

Pattern for each file:

1. Replace `useInkplainerEngine` → `useUnifiedEngine`
2. Replace `useAnimationContext` → `useUnifiedEngine`
3. Update all state setters to use new hook

**Example for `whiteboard-editor-step.tsx`:**

**Before:**
```typescript
import { useInkplainerEngine } from '../hooks/use-inkplainer-engine';
import { useAnimationContext } from '../context/animation-context';

export function WhiteboardEditorStep() {
  const { isPlaying, progress } = useInkplainerEngine({...});
  const { setAnimStyle } = useAnimationContext();
  // ...
}
```

**After:**
```typescript
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';

export function WhiteboardEditorStep() {
  const { isPlaying, progress, setAnimStyle } = useUnifiedEngine();
  // ...
}
```

- [ ] **Step 3: Update all components systematically**

Create a script to help (optional):

```bash
# Replace all old imports in whiteboard components
find lib/whiteboard-animation/components -name "*.tsx" -exec sed -i \
  "s|import { useInkplainerEngine } from '../hooks/use-inkplainer-engine'|import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine'|g" {} \;

find lib/whiteboard-animation/components -name "*.tsx" -exec sed -i \
  "s|import { useAnimationContext } from '../context/animation-context'||g" {} \;
```

Then manually verify and fix each file.

- [ ] **Step 4: Verify all components render**

```bash
npm run dev
# Test: play/pause, change animation style, change hand style, adjust speed
# Verify all settings sync correctly
```

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/components/
git commit -m "refactor: migrate all whiteboard components to unified engine"
```

---

### Task 2.4: Delete old whiteboard hooks and contexts

**Files:**
- Delete: `lib/whiteboard-animation/hooks/use-inkplainer-engine.ts`
- Delete: `lib/whiteboard-animation/hooks/use-animation-engine.ts`
- Delete: `lib/whiteboard-animation/context/animation-context.tsx`
- Create: `lib/whiteboard-animation/DEPRECATION_NOTICE.md`

**Steps:**

- [ ] **Step 1: Create deprecation notice**

Create `lib/whiteboard-animation/DEPRECATION_NOTICE.md`:

```markdown
# Whiteboard Animation Module — Deprecation Notice

**Status**: Legacy (UI components maintained, engine replaced)

The animation engine and state management have been migrated to `/lib/unified-engine`.

## Old API (DEPRECATED)

- ❌ `useInkplainerEngine` → use `useUnifiedEngine` instead
- ❌ `useAnimationContext` → use `useUnifiedEngine` instead
- ❌ `AnimationContext` → engine state now in `UnifiedEngineContext`

## Current State

- ✅ UI Components (`components/`) — updated to use unified engine
- ✅ Legacy Animation Libs (`lib/`) — wrapped by unified engine, unchanged
- ⚠️ Old Hooks/Contexts — removed, do not use

## Using the Unified Engine

```typescript
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';

const { isPlaying, togglePlay, progress } = useUnifiedEngine();
```

## Questions?

See `/lib/unified-engine/README.md` for full documentation.
```

- [ ] **Step 2: Verify no remaining imports of old hooks**

```bash
grep -r "use-inkplainer-engine" lib/ src/ --include="*.ts" --include="*.tsx" | grep -v DEPRECATION
grep -r "useAnimationContext" lib/ src/ --include="*.ts" --include="*.tsx" | grep -v DEPRECATION
```

If any hits, update those files first.

- [ ] **Step 3: Delete old files**

```bash
rm lib/whiteboard-animation/hooks/use-inkplainer-engine.ts
rm lib/whiteboard-animation/hooks/use-animation-engine.ts
rm lib/whiteboard-animation/context/animation-context.tsx
```

- [ ] **Step 4: Commit**

```bash
git add -A lib/whiteboard-animation/
git commit -m "refactor: remove deprecated whiteboard hooks and contexts"
```

---

## Phase 3: Timeline & Editor Components Migration

*(Remaining phases follow similar pattern: identify components, migrate to useUnifiedEngine, update state usage, test, commit)*

### Task 3.1: Migrate timeline-related components

**Files:**
- Modify: `lib/editor/components/timeline-clip.tsx`
- Modify: `lib/editor/components/timeline-storyboard.tsx`
- Modify: `lib/editor/components/timeline-toolbar.tsx`

**Interfaces:**
- Consumes: `useUnifiedEngine`, existing timeline component logic
- Produces: Components synced with unified playback state

**Steps:**

- [ ] **Step 1: Update timeline-clip.tsx**

Replace editor-specific context imports with `useUnifiedEngine`

- [ ] **Step 2: Update timeline-storyboard.tsx**

Sync timeline navigation with unified `currentTime`

- [ ] **Step 3: Update timeline-toolbar.tsx**

Use unified playback controls

- [ ] **Step 4: Test timeline playback**

```bash
npm run dev
# Verify: play/pause works, seek works, progress indicator syncs
```

- [ ] **Step 5: Commit**

```bash
git add lib/editor/components/timeline-*.tsx
git commit -m "refactor: migrate timeline components to unified engine"
```

---

### Task 3.2: Migrate editor UI panels

**Files:**
- Modify: `lib/editor/components/editor-sidebar.tsx`
- Modify: `lib/editor/components/inspector-panel.tsx`
- Modify: `lib/editor/components/settings-panel.tsx`

**Steps:**

- [ ] Update all panel components to use `useUnifiedEngine`
- [ ] Test inspector updates reflect in animation state
- [ ] Commit with message: `refactor: migrate editor panels to unified engine`

---

## Phase 4: Full Integration & Testing

### Task 4.1: End-to-end sync testing

**Files:**
- Create: `__tests__/lib/unified-engine/integration/playback-sync.test.ts`

**Steps:**

- [ ] **Write integration test**

```typescript
import { renderHook, act } from '@testing-library/react';
import { useUnifiedEngine } from '@/lib/unified-engine/hooks/useUnifiedEngine';

describe('Unified Engine Playback Sync', () => {
  test('timeline seek syncs with animation progress', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    act(() => {
      result.current.setDuration(10000);
      result.current.setCurrentTime(5000);
    });

    // Progress should be 50%
    expect(result.current.progress).toBe(50);
  });

  test('play/pause state syncs between timeline and animation', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    act(() => {
      result.current.togglePlay();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(result.current.timeline.isPlaying).toBe(true);
  });

  test('animation settings persist across play cycles', () => {
    const { result } = renderHook(() => useUnifiedEngine());

    act(() => {
      result.current.setAnimStyle('scribble');
      result.current.setRevealSpeed(75);
      result.current.togglePlay();
    });

    // Settings should persist
    expect(result.current.animStyle).toBe('scribble');
    expect(result.current.revealSpeed).toBe(75);
  });
});
```

- [ ] **Run tests**

```bash
npm test -- __tests__/lib/unified-engine/integration/
```

- [ ] **Commit**

```bash
git add __tests__/lib/unified-engine/integration/
git commit -m "test: add end-to-end playback sync integration tests"
```

---

### Task 4.2: Performance & stress testing

**Files:**
- Create: `__tests__/lib/unified-engine/performance.test.ts`

**Steps:**

- [ ] Write performance test measuring re-renders and state update times
- [ ] Verify no memory leaks during long playback
- [ ] Commit: `test: add performance baseline for unified engine`

---

## Phase 5: Cleanup & Documentation

### Task 5.1: Remove old editor/whiteboard context usage

**Files:**
- Search and delete remaining old imports

**Steps:**

- [ ] ```bash
grep -r "EditorContext\|AnimationContext" lib/ src/ --include="*.ts" --include="*.tsx" | grep -v unified-engine | grep -v DEPRECATION
```

- [ ] Delete/update any remaining files using old contexts
- [ ] Commit: `refactor: remove all old editor/animation contexts`

---

### Task 5.2: Update project documentation

**Files:**
- Modify: `lib/README.md`
- Create: `docs/ARCHITECTURE.md` section for unified engine

**Steps:**

- [ ] Update `lib/README.md` to reference unified engine
- [ ] Document migration path for anyone working on the codebase
- [ ] Commit: `docs: update architecture documentation for unified engine`

---

## Verification Checklist

After all phases complete, verify:

- [ ] No imports of `useInkplainerEngine`, `useAnimationContext`, or old `EditorContext`
- [ ] All components use `useUnifiedEngine` exclusively
- [ ] Whiteboard and timeline playback stay in perfect sync
- [ ] All settings (speed, hand style, annotations, etc.) work end-to-end
- [ ] TypeScript builds with zero errors: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] No performance regression (60fps maintained)
- [ ] Can record whiteboard animations end-to-end

---

## Deployment Checklist

- [ ] All tests passing locally
- [ ] Code reviewed
- [ ] Performance tested (60fps maintained)
- [ ] Backward compatibility verified
- [ ] Spec requirements met
- [ ] Documentation updated
- [ ] Ready for merge to main
