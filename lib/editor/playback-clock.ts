"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The playback clock, kept OUTSIDE the React render cycle.
 *
 * WHY
 * The playback position changes every frame. While it lived in a useState of
 * the editor, every tick re-rendered everything below it — the timeline and
 * its dozens of clips, the preview, the dialogs — at the loop's rate. Even
 * throttled to 30 Hz, that is a full editor render 30 times per second to move
 * a cursor a few pixels.
 *
 * HOW
 * The value lives here, in a module. Whoever needs it subscribes, and only the
 * subscriber re-renders: the cursor, the ruler, the text overlay. Whoever only
 * needs it when acting — dropping a marker, splitting a clip, a keyboard
 * shortcut — READS it at that moment, without subscribing at all.
 *
 * Same approach as `onViewportChange` in the timeline, which hands scrolling
 * back to the caller instead of pushing it into React state: a value that
 * changes every frame does not go through rendering.
 */

let position = 0;
const subscribers = new Set<() => void>();

/** The current position, in seconds. One-off read, no subscription. */
export function readPlaybackPosition(): number {
  return position;
}

/**
 * Sets the position and wakes the subscribers.
 *
 * If the value is unchanged, nobody is woken: the loop can call this every
 * frame, and a paused playback renders nothing.
 */
export function setPlaybackPosition(value: number): void {
  if (value === position) return;
  position = value;
  for (const subscriber of subscribers) subscriber();
}

/**
 * Subscribes to clock ticks. Returns the unsubscribe function.
 * Exported because not everything is a component: an effect or an
 * imperatively drawn layer hooks in the same way.
 */
export function subscribeToPlaybackPosition(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

/**
 * Subscribes to the clock. The calling component re-renders on every tick:
 * reserve it for leaves — a cursor, a counter — never for a component that
 * owns a subtree.
 */
export function usePlaybackPosition(): number {
  return useSyncExternalStore(
    subscribeToPlaybackPosition,
    readPlaybackPosition,
    readPlaybackPosition,
  );
}

/**
 * Subscribes to a value DERIVED from the clock, re-rendering only when that
 * value changes.
 *
 * The typical case is "which clip is under the cursor": the position changes
 * every frame, the answer a few times per minute. `select` must return a value
 * comparable by identity — a primitive, or an already stable object such as an
 * element of the clips array.
 */
export function useDerivedPlaybackValue<T>(select: (positionMs: number) => T): T {
  const read = useCallback(() => select(position), [select]);
  return useSyncExternalStore(subscribeToPlaybackPosition, read, read);
}
