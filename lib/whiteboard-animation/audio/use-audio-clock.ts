'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioManager } from './audio-manager';

export interface AudioClockState {
  manager: AudioManager | null;
  currentMs: number;
  durationMs: number;
  isReady: boolean;
}

export function useAudioClock(url: string | null): AudioClockState {
  const managerRef = useRef<AudioManager | null>(null);
  const [state, setState] = useState<AudioClockState>({
    manager: null,
    currentMs: 0,
    durationMs: 0,
    isReady: false,
  });

  useEffect(() => {
    if (!url) {
      managerRef.current?.destroy();
      managerRef.current = null;
      setState({ manager: null, currentMs: 0, durationMs: 0, isReady: false });
      return;
    }

    const manager = new AudioManager();
    managerRef.current = manager;
    manager.load(url);

    const unsubscribeTime = manager.onTimeUpdate((ms) => {
      setState((prev) => ({ ...prev, currentMs: ms }));
    });

    const el = manager.getElement();
    const onLoadedMetadata = () => {
      setState((prev) => ({
        ...prev,
        durationMs: manager.getDurationMs(),
        isReady: true,
      }));
    };
    el.addEventListener('loadedmetadata', onLoadedMetadata);

    setState({ manager, currentMs: 0, durationMs: 0, isReady: false });

    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      unsubscribeTime();
      manager.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return state;
}
