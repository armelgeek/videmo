'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioManager } from './audio-manager';
import { NarrationPlayer } from './narration-player';
import type { NarrationPart } from './narration-schedule';

/**
 * Ce que la boucle de rendu attend d'une source sonore, quelle qu'elle soit :
 * une piste unique televersee, ou la voix produite temps par temps.
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
 * L'horloge sonore de l'apercu.
 *
 * `parts` prime : c'est la voix telle que la chaine la produit. `url` reste le
 * chemin d'une piste televersee a la main, et celui des projets enregistres
 * avant le decoupage par temps.
 *
 * Le decoupage est identifie par sa forme et non par sa reference : le tableau
 * est recree a chaque rendu de React, et s'y abonner rechargerait la voix
 * plusieurs fois par seconde.
 */
export function useNarrationClock(
  parts: NarrationPart[],
  url: string | null,
): NarrationClockState {
  const empreinte = parts.map((p) => `${p.url}@${p.startMs}`).join("|");
  const managerRef = useRef<NarrationClock | null>(null);
  const [state, setState] = useState<NarrationClockState>({
    manager: null,
    durationMs: 0,
    isReady: false,
  });

  useEffect(() => {
    managerRef.current?.destroy();
    managerRef.current = null;

    if (empreinte) {
      const player = new NarrationPlayer(parts);
      // Charge des maintenant : au clic, l'element doit etre pret, sinon la
      // voix demarre en retard sur le dessin et perd son attaque.
      player.prepare();
      managerRef.current = player;
      setState({
        manager: player,
        durationMs: player.getDurationMs(),
        // Les durees sont deja connues, mesurees a la synthese : rien a
        // attendre d'un chargement pour savoir combien de temps ca dure.
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

    const manager = new AudioManager();
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
    // parts est volontairement absent : `empreinte` en porte le contenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreinte, url]);

  return state;
}
