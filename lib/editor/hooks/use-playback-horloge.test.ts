import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lirePositionLecture, poserPositionLecture } from "../playback-clock";
import { usePlayback } from "./use-playback";

/**
 * Ce qui est verifie ici est la SEMANTIQUE de l'horloge, pas la lecture des
 * medias : `currentTime` ne suit plus la lecture image par image — c'est
 * l'horloge externe qui la porte — mais il doit encore marquer les instants
 * discrets, et surtout la position ou l'on reprend apres une pause.
 */

const options = {
  timelineClips: [],
  tracks: [],
  mediaMap: {},
  timelineDuration: 30,
  isExporting: false,
  isRendering: false,
};

/**
 * Un requestAnimationFrame simule : les callbacks sont mis en file, et
 * `avancer` les rejoue avec une horloge que le test controle. Passer par les
 * vrais timers rendrait la mesure dependante du temps qui passe.
 */
let horloge = 0;
let enAttente = new Map<number, FrameRequestCallback>();
let prochainId = 1;

/** Fait tourner la boucle de `ms` millisecondes de temps simule. */
async function avancer(ms: number) {
  const pas = 16;
  for (let ecoule = 0; ecoule < ms; ecoule += pas) {
    horloge += pas;
    const aJouer = [...enAttente.entries()];
    enAttente = new Map();
    await act(async () => {
      for (const [, cb] of aJouer) cb(horloge);
    });
  }
}

describe("usePlayback — horloge", () => {
  beforeEach(() => {
    poserPositionLecture(0);
    horloge = 0;
    enAttente = new Map();
    prochainId = 1;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = prochainId++;
      enAttente.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      enAttente.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("avance l'horloge externe pendant la lecture", async () => {
    const { result } = renderHook(() => usePlayback(options));

    act(() => {
      result.current.setIsPlaying(true);
    });
    await avancer(300);

    expect(lirePositionLecture()).toBeGreaterThan(0);
  });

  it("reprend la lecture la ou la pause l'a laissee", async () => {
    const { result } = renderHook(() => usePlayback(options));

    act(() => {
      result.current.setIsPlaying(true);
    });
    await avancer(300);

    const aLaPause = lirePositionLecture();
    expect(aLaPause).toBeGreaterThan(0);

    act(() => {
      result.current.setIsPlaying(false);
    });

    // L'arret publie la position REELLE dans l'etat React : sans cela, il
    // porterait encore celle du dernier seek et la reprise repartirait de la.
    expect(result.current.currentTime).toBeCloseTo(aLaPause, 5);

    act(() => {
      result.current.setIsPlaying(true);
    });
    await avancer(100);

    expect(lirePositionLecture()).toBeGreaterThanOrEqual(aLaPause);
  });

  it("un seek pose la position sur l'horloge externe et dans l'etat", () => {
    const { result } = renderHook(() => usePlayback(options));

    act(() => {
      result.current.handleSeek(12);
    });

    expect(lirePositionLecture()).toBe(12);
    expect(result.current.currentTime).toBe(12);
  });

  it("ne repart pas au debut quand les clips changent d'identite en pleine lecture", async () => {
    const { result, rerender } = renderHook((props) => usePlayback(props), {
      initialProps: { ...options },
    });

    act(() => {
      result.current.setIsPlaying(true);
    });
    await avancer(300);

    const avantRendu = lirePositionLecture();
    expect(avantRendu).toBeGreaterThan(0);

    // Un tableau vide MAIS neuf : c'est ce que produit n'importe quel rendu
    // amont qui reconstruit ses clips. Cela renouvelait l'identite d'`animate`,
    // relancait l'effet de demarrage, et le ramenait a la position de reprise.
    rerender({ ...options, timelineClips: [] });
    await avancer(100);

    expect(lirePositionLecture()).toBeGreaterThanOrEqual(avantRendu);
  });

  it("ne bondit pas a la fin quand une frame arrive tres en retard", async () => {
    const { result } = renderHook(() => usePlayback(options));

    act(() => {
      result.current.setIsPlaying(true);
    });
    await avancer(100);

    const avantGel = lirePositionLecture();

    // Un gel du thread principal, comme celui que provoque le chargement de la
    // source au passage au clip suivant : la frame suivante arrive dix
    // secondes plus tard, soit bien au-dela de `timelineDuration`.
    horloge += 10_000;
    const aJouer = [...enAttente.values()];
    enAttente = new Map();
    await act(async () => {
      for (const cb of aJouer) cb(horloge);
    });

    // La lecture prend du retard, elle ne saute pas : la tete a avance d'au
    // plus un pas borne, et la timeline n'est pas arrivee a son terme.
    const apresGel = lirePositionLecture();
    expect(apresGel).toBeGreaterThan(avantGel);
    expect(apresGel).toBeLessThan(avantGel + 0.5);
    expect(result.current.isPlaying).toBe(true);
  });

  it("reprend depuis la position cherchee pendant une pause", async () => {
    const { result } = renderHook(() => usePlayback(options));

    act(() => {
      result.current.handleSeek(5);
    });
    act(() => {
      result.current.setIsPlaying(true);
    });
    await avancer(200);

    expect(lirePositionLecture()).toBeGreaterThanOrEqual(5);
  });
});
