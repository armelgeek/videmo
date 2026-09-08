import { describe, expect, it } from "vitest";
import { NarrationPlayer } from "./narration-player";

/**
 * jsdom stub play()/pause()/load() sans effet, mais currentTime, playbackRate
 * et readyState restent des proprietes reelles : le rattrapage par tempo ne
 * touche a rien d'autre, donc se prouve directement ici, contrairement au
 * reste du lecteur (voir le commentaire de classe de NarrationPlayer).
 */
const setReadyState = (el: HTMLMediaElement, value: number) =>
  Object.defineProperty(el, "readyState", { value, configurable: true });

const setCurrentTime = (el: HTMLMediaElement, seconds: number) =>
  Object.defineProperty(el, "currentTime", { value: seconds, writable: true, configurable: true });

describe("NarrationPlayer — rattrapage d'un ecart", () => {
  it("nudge le tempo pour un petit ecart, sans sauter", () => {
    const player = new NarrationPlayer([{ url: "a", startMs: 0, durationMs: 5000 }]);
    player.prepare();
    const el = player.getElement();
    setReadyState(el, HTMLMediaElement.HAVE_CURRENT_DATA);
    setCurrentTime(el, 0.2);

    player.seekMs(700);

    expect(el.currentTime).toBeCloseTo(0.2, 5);
    expect(el.playbackRate).toBeGreaterThan(1);
    expect(el.playbackRate).toBeLessThanOrEqual(1.05);
  });

  it("saute directement pour un ecart enorme", () => {
    const player = new NarrationPlayer([{ url: "a", startMs: 0, durationMs: 5000 }]);
    player.prepare();
    const el = player.getElement();
    setReadyState(el, HTMLMediaElement.HAVE_CURRENT_DATA);
    setCurrentTime(el, 0.2);

    player.seekMs(3000);

    expect(el.currentTime).toBeCloseTo(3, 5);
    expect(el.playbackRate).toBe(1);
  });

  it("revient au tempo normal une fois l'ecart resorbe", () => {
    const player = new NarrationPlayer([{ url: "a", startMs: 0, durationMs: 5000 }]);
    player.prepare();
    const el = player.getElement();
    setReadyState(el, HTMLMediaElement.HAVE_CURRENT_DATA);
    setCurrentTime(el, 0.2);

    player.seekMs(700);
    expect(el.playbackRate).not.toBe(1);

    setCurrentTime(el, 0.7);
    player.seekMs(700);

    expect(el.playbackRate).toBe(1);
  });

  it("ne redemande pas de saut tant que le precedent n'a pas abouti", () => {
    const player = new NarrationPlayer([{ url: "a", startMs: 0, durationMs: 5000 }]);
    player.prepare();
    const el = player.getElement();
    setReadyState(el, HTMLMediaElement.HAVE_CURRENT_DATA);
    setCurrentTime(el, 0.2);
    Object.defineProperty(el, "seeking", { value: true, configurable: true });

    player.seekMs(3000);

    // Toujours a la position d'avant : le saut a ete refuse pendant le
    // precedent (simule ici via `seeking`), pas rejoue par-dessus.
    expect(el.currentTime).toBeCloseTo(0.2, 5);
  });
});
