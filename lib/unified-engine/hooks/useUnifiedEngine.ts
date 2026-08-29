'use client';

import { useUnifiedEngineStore } from '../context';
import type { UnifiedEngineState } from '../types';

type Selector = (state: UnifiedEngineState) => any;

export function useUnifiedEngine<T = any>(selector?: Selector): T {
  if (selector) {
    return useUnifiedEngineStore(selector);
  }

  // No selector: return entire store (state + all actions as one object)
  // Zustand returns the same object reference, preventing infinite re-renders
  return useUnifiedEngineStore() as T;
}
