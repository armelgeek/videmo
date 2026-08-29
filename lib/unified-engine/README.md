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
