# TypeScript Conversion Guide

## Strategy

Converting all 50+ sketchpilot files to TypeScript can be done in two approaches:

### Approach 1: Hybrid (Recommended for quick integration)
- Keep original .js files as-is (for stability)
- Create .ts wrapper files with proper typing
- Export typed interfaces through index.ts
- Gradually convert individual files as needed

### Approach 2: Full TypeScript
- Convert all .js files to .ts
- Add complete type definitions
- Update all imports and dependencies
- Takes more time but provides full type safety

## Current Status

### Already Converted to TypeScript ✅
- `Animation.ts` - Base animation class
- `types.ts` - All type definitions
- `index.ts` - Barrel export
- `components/` - All React components
- `hooks/use-whiteboard.ts` - State management
- `services/whiteboard-editor-service.ts` - Integration service

### Recommended Next Steps

#### Phase 1: TypeScript Wrappers (Quick)
Create lightweight .ts wrappers for main modules:
- `AnimationFactory.ts` - Wrapper around index.js
- `AnimationStyles.ts` - Wrapper around styles/
- `AnimationUtils.ts` - Wrapper around AnimationUtils.js
- `EditorEngine.ts` - Wrapper around editor/EditorEngine.js
- `Timeline.ts` - Wrapper around editor/Timeline.js

#### Phase 2: Direct Conversion (If needed)
Convert high-impact files directly:
1. `project.ts` - Project management
2. `AnnotationManager.ts` - Annotation support
3. Individual style files as needed

#### Phase 3: Full Coverage
Convert remaining utility files gradually.

## Implementation Plan

### Quick Start with Wrappers

```typescript
// AnimationFactory.ts
import type { AnimationStyle } from './types';

const AnimationFactory = require('./index.js');

export interface AnimationOptions {
  lineColor?: string;
  lineWidth?: number;
  speed?: number;
  [key: string]: any;
}

export function createAnimation(
  styleName: AnimationStyle,
  options: AnimationOptions
): any {
  return AnimationFactory.create(styleName, options);
}

export { AnimationFactory };
export default AnimationFactory;
```

### Type Definitions for JS Modules

```typescript
// declarations/whiteboard.d.ts
declare module '@/lib/whiteboard-animation/index.js' {
  interface AnimationFactory {
    create(style: string, options: any): any;
  }
  const factory: AnimationFactory;
  export = factory;
}

declare module '@/lib/whiteboard-animation/editor/EditorEngine.js' {
  interface EditorEngine {
    state: any;
    // ... other properties
  }
  export function createEditorEngine(config: any): EditorEngine;
}
```

## Files Requiring TypeScript Conversion

### Critical Path (For functionality)
1. **Animation System**
   - [ ] Animation.ts ✅ (Done)
   - [ ] AnimationFactory wrapper
   - [ ] AnimationStyles.ts wrapper
   - [ ] AnimationUtils.ts wrapper

2. **Editor System**
   - [ ] EditorEngine.ts wrapper
   - [ ] Timeline.ts wrapper

3. **Project Management**
   - [ ] project.ts

### Nice to Have (For completeness)
- [ ] styles/*.js individual conversions
- [ ] AnnotationManager.ts full conversion
- [ ] hands.ts utility conversion
- [ ] handLayout.ts utility conversion
- [ ] transitions.ts utility conversion

## How to Convert a File

### Example: Converting AnimationUtils.js

**Original (JS):**
```javascript
module.exports = {
  clamp: (val, min, max) => Math.max(min, Math.min(val, max)),
  lerp: (a, b, t) => a + (b - a) * t,
};
```

**Converted (TS):**
```typescript
export interface AnimationUtilsInterface {
  clamp(val: number, min: number, max: number): number;
  lerp(a: number, b: number, t: number): number;
}

export const AnimationUtils: AnimationUtilsInterface = {
  clamp: (val: number, min: number, max: number): number =>
    Math.max(min, Math.min(val, max)),
  lerp: (a: number, b: number, t: number): number =>
    a + (b - a) * t,
};

export default AnimationUtils;
```

## TypeScript Configuration

### Update tsconfig.json
```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": [
    "lib/whiteboard-animation/**/*"
  ]
}
```

## Gradual Migration Path

### Week 1: Setup
- ✅ Create TypeScript wrappers for main modules
- ✅ Add type definitions
- ✅ Export through index.ts

### Week 2-3: Critical Files
- Convert Animation.ts ✅ (Done)
- Convert EditorEngine to EditorEngine.ts
- Convert Timeline to Timeline.ts

### Week 4+: Remaining Files
- Convert individual style files as needed
- Convert utility files
- Add complete type coverage

## Benefits of Full TypeScript

✅ Type safety across the board
✅ Better IDE autocomplete
✅ Easier refactoring
✅ Self-documenting code
✅ Catch errors at compile time
✅ Better developer experience

## Trade-offs

⚠️ Takes more development time
⚠️ More complex build process
⚠️ Larger bundle size (minimal with tree-shaking)
⚠️ Learning curve for team

## Alternative: Type-Only Files

Keep .js files, create parallel .d.ts type definition files:

```typescript
// Animation.d.ts
export interface AnimationConfig {
  state: any;
  ctx: CanvasRenderingContext2D;
  hctx: CanvasRenderingContext2D;
  offscreen: HTMLCanvasElement;
  callbacks?: {
    fillBg?: () => void;
    drawHand?: () => void;
    setProgress?: (p: number) => void;
    finishAnim?: () => void;
    resScale?: () => number;
    resPointScale?: () => number;
  };
}

export class Animation {
  constructor(config: AnimationConfig);
  setup(): void;
  tick(speed: number): void;
  buildPresenceMap(): Uint8Array;
  ensureRevealCanvas(): void;
  getActiveAnnotations(deltaMs?: number): any[];
}
```

## Recommended Approach

**Start with hybrid approach:**
1. Keep original .js files
2. Create .ts wrappers for imports
3. Add type definitions gradually
4. Convert files as you work on features

This provides:
- ✅ Immediate type safety for new code
- ✅ No breaking changes
- ✅ Gradual migration path
- ✅ Stability for production
- ✅ Flexibility for team

## Getting Help

1. Check existing converted files as examples
2. Use TypeScript strict mode for new files
3. Add types incrementally
4. Test thoroughly after each conversion

## Next Steps

1. Decide on approach (Hybrid recommended)
2. Create wrapper files as needed
3. Add type definitions
4. Update imports in components
5. Test thoroughly
6. Gradually convert critical files

---

**Current Status**: Core TypeScript infrastructure in place. JavaScript files are functional and can be gradually migrated to TypeScript as needed.
