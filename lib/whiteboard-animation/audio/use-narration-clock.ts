'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioManager } from './audio-manager';
import { NarrationPlayer } from './narration-player';
import type { NarrationPart } from './narration-schedule';

/**
 * What the render loop expects from a sound source, whatever it is: a single
 * uploaded track, or the voice produced beat by beat.
 */
export interface NarrationClock {
  isUsableClock(): boolean;
  isSeeking(): boolean;
  setPlaybackRate(rate: number): void;
  getCurrentMs(): number;
  getDurationMs(): number;
  seekMs(ms: number): void;
  follow(positionMs: number): void;
  play(): Promise<void>;
  pause(): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  getElement(): HTMLAudioElement;
  destroy(): void;
}

export interface NarrationClockState {
  manager: NarrationClock | null;
  durationMs: number;
  isReady: boolean;
}

/**
 * The preview's audio clock.
 *
 * `parts` takes precedence: it is the voice as the pipeline produces it. `url`
 * remains the path for a manually uploaded track, and for projects saved
 * before the per-beat split.
 *
 * The split is identified by its shape, not its reference: the array is
 * recreated on every React render, and subscribing to it would reload the
 * voice several times per second.
 */
export function useNarrationClock(
  parts: NarrationPart[],
  url: string | null,
  onError: (message: string) => void = () => {},
): NarrationClockState {
  const fingerprint = parts.map((p) => `${p.url}@${p.startMs}`).join("|");
  const managerRef = useRef<NarrationClock | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [state, setState] = useState<NarrationClockState>({
    manager: null,
    durationMs: 0,
    isReady: false,
  });

  useEffect(() => {
    managerRef.current?.destroy();
    managerRef.current = null;

    if (fingerprint) {
      const player = new NarrationPlayer(parts, (m) => onErrorRef.current(m));
      // Load right away: on click the element must be ready, otherwise the
      // voice starts late relative to the drawing and loses its attack.
      player.prepare();
      managerRef.current = player;
      setState({
        manager: player,
        durationMs: player.getDurationMs(),
        // Durations are already known, measured at synthesis: no need to wait
        // for a load to know how long it lasts.
        isReady: true,
      });
      return () => {
        player.destroy();
      };
    }

    if (!url) {
      setState({ manager: null, durationMs: 0, isReady: false });
      return;
    }

    const manager = new AudioManager((m) => onErrorRef.current(m));
    managerRef.current = manager;
    manager.load(url);

    const el = manager.getElement();
    const onLoadedMetadata = () => {
      setState((prev) => ({
        ...prev,
        durationMs: manager.getDurationMs(),
        isReady: true,
      }));
    };
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    setState({ manager, durationMs: 0, isReady: false });

    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      manager.destroy();
    };
    // parts is deliberately omitted: `fingerprint` carries its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, url]);

  return state;
}
