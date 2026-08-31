'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioManager } from './audio-manager';

export interface AudioClockState {
  manager: AudioManager | null;
  durationMs: number;
  isReady: boolean;
}

export function useAudioClock(url: string | null): AudioClockState {
  const managerRef = useRef<AudioManager | null>(null);
  const [state, setState] = useState<AudioClockState>({
    manager: null,
    durationMs: 0,
    isReady: false,
  });

  useEffect(() => {
    if (!url) {
      managerRef.current?.destroy();
      managerRef.current = null;
      setState({ manager: null, durationMs: 0, isReady: false });
      return;
    }

    const manager = new AudioManager();
    managerRef.current = manager;
    manager.load(url);

    // Deliberately NOT subscribed to timeupdate: the playback position is read
    // straight off the manager inside the rAF loop. Publishing it through
    // React state re-rendered the whole renderer several times a second for a
    // value no one consumed.

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return state;
}
