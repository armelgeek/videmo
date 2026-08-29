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
