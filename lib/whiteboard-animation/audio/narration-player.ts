import { AudioManager } from "./audio-manager";
import {
  type NarrationPart,
  nextNarrationAction,
  narrationEndMs,
  partAt,
} from "./narration-schedule";

/** Beyond this, a cut is better than a drift that would last for seconds. */
const HARD_SEEK_MS = 1500;

/**
 * FIXED catch-up tempo. Every playbackRate change restarts the browser's
 * time stretcher and is heard as a small click: a nudge recomputed every
 * frame produced dozens per second.
 */
const NUDGE = 0.03;

/**
 * An engaged catch-up runs down to this threshold, well below the one that
 * triggered it: without this hysteresis, the gap oscillated around the
 * threshold and the tempo kept flipping between 1 and the nudge.
 */
const RELEASE_MS = 25;

/**
 * Plays the narration recording by recording, while presenting the render
 * loop with the interface of ONE continuous track.
 *
 * The loop reasons on the PROJECT clock: it asks for the current position and
 * resyncs when the sound drifts. Here that position becomes "which recording,
 * at what point", so the loop does not need to know the voice comes from
 * several files.
 *
 * TWO elements, not one: loading at switch time cost measured dead time —
 * three loads in 200 ms, and 65 ms of the next attack skipped, because the
 * loop resynced the voice onto a drawing that did not wait. While one element
 * plays, the other prepares the next; the switch is just a swap.
 *
 * The decision lives in `nextNarrationAction`, tested on its own: jsdom
 * implements neither `play` nor `load`, so this player cannot be proven directly.
 */
export class NarrationPlayer {
  private managers: [AudioManager, AudioManager];
  /** Which recording each element holds, `null` if it holds none. */
  private holds: (number | null)[] = [null, null];
  private active = 0;
  private index: number | null = null;
  private wantsPlay = false;
  private volume = 1;
  private muted = false;
  /**
   * The target position, while the source is not ready. Without it, the
   * element's position stays at zero during loading, the gap looks huge, and
   * every frame requests another resync.
   */
  private expectedMs: number | null = null;

  constructor(
    private parts: NarrationPart[],
    onError: (message: string) => void = () => {},
  ) {
    // BOTH elements share the same channel: the user does not need to know
    // which of the two failed, only that a recording did not load.
    this.managers = [new AudioManager(onError), new AudioManager(onError)];
  }

  private get manager(): AudioManager {
    return this.managers[this.active];
  }

  /**
   * Loads the first recording, and prepares the next.
   *
   * Without this, loading started ON CLICK: the drawing started meanwhile and
   * the loop then aligned the voice onto it, skipping what had elapsed —
   * 117 ms measured, i.e. the attack of the first word lost.
   */
  prepare(): void {
    if (this.parts.length === 0) return;
    this.active = 0;
    this.index = 0;
    this.expectedMs = 0;
    this.loadInto(0, 0);
    this.prepareNext(0);
  }

  private loadInto(part: number, slot: number): void {
    if (this.holds[slot] === part) return;
    this.holds[slot] = part;
    void this.managers[slot].load(this.parts[part].url);
  }

  /** The free element takes the next recording while the other plays. */
  private prepareNext(part: number): void {
    const next = part + 1;
    if (next >= this.parts.length) return;
    this.loadInto(next, 1 - this.active);
  }

  getElement(): HTMLAudioElement {
    return this.manager.getElement();
  }

  /** The whole narration, from the start of the first recording to the end of the last. */
  getDurationMs(): number {
    return narrationEndMs(this.parts);
  }

  /** The position on the PROJECT clock, not within the current recording. */
  getCurrentMs(): number {
    if (this.index === null) return 0;
    return this.parts[this.index].startMs + this.manager.getCurrentMs();
  }

  /**
   * Move to this instant of the project: swap elements if the recording must
   * change, resync otherwise, go silent in a gap.
   */
  seekMs(positionMs: number): void {
    const ready = this.manager.getElement().readyState > 0;
    const offsetMs =
      this.index === null
        ? 0
        : !ready && this.expectedMs !== null
          ? this.expectedMs
          : this.manager.getCurrentMs();
    if (ready) this.expectedMs = null;

    const action = nextNarrationAction(
      { index: this.index, offsetMs },
      this.parts,
      positionMs,
    );

    if (action.type === "none") {
      const rate = this.manager.getPlaybackRate();
      if (rate === 1) return;
      // The catch-up continues until the gap is absorbed, and stops if it
      // overshoots in the other direction.
      const target = partAt(this.parts, positionMs);
      const gapMs = target ? target.offsetMs - offsetMs : 0;
      if (Math.abs(gapMs) <= RELEASE_MS || Math.sign(gapMs) !== Math.sign(rate - 1)) {
        this.manager.setPlaybackRate(1);
      }
      return;
    }

    if (action.type === "silence") {
      this.manager.pause();
      this.manager.setPlaybackRate(1);
      this.index = null;
      this.expectedMs = null;
      return;
    }

    if (action.type === "load") {
      // The idle element usually already holds the next recording: the switch
      // is then just a swap, with no loading or dead time.
      const previous = this.active;
      const other = 1 - this.active;
      if (this.holds[other] !== action.index) this.loadInto(action.index, other);
      this.active = other;

      this.index = action.index;
      this.expectedMs = action.offsetMs;
      this.manager.setVolume(this.volume);
      this.manager.setMuted(this.muted);
      this.manager.setPlaybackRate(1);

      // If the element is already at the desired position (e.g. start at 0),
      // avoid an async seekMs that freezes browser playback.
      if (Math.abs(this.manager.getCurrentMs() - action.offsetMs) > 20) {
        this.manager.seekMs(action.offsetMs);
      }

      if (this.wantsPlay) {
        this.manager.play().catch((error) => {
          console.error("Failed to start narration playback:", error);
        });
      }
      this.managers[previous].pause();
      this.prepareNext(action.index);
      return;
    }

    // The previous seek has not finished loading: requesting another now would
    // only push it back again, never letting the voice catch up. Wait for the
    // next frame, when it may have completed.
    if (this.manager.isSeeking()) return;

    const gapMs = action.offsetMs - offsetMs;

    // A huge gap (returning to a sleeping tab, manual seek) cannot be caught up
    // smoothly in a reasonable time: a cut is less annoying there than a drift
    // lasting several seconds.
    if (Math.abs(gapMs) > HARD_SEEK_MS) {
      this.expectedMs = action.offsetMs;
      this.manager.setPlaybackRate(1);
      this.manager.seekMs(action.offsetMs);
      return;
    }

    // Below that, catch up via TEMPO rather than a jump: playing slightly
    // faster or slower for a few seconds is inaudible, whereas every cut is
    // heard. See AudioManager.setPlaybackRate.
    this.manager.setPlaybackRate(gapMs > 0 ? 1 + NUDGE : 1 - NUDGE);
  }

  /** Follow the project clock, every frame. */
  follow(positionMs: number): void {
    this.seekMs(positionMs);
  }

  /**
   * Start. With no recording loaded — the project starts with a gap — only
   * the intent is recorded: the next `seekMs` that lands on a voice will start
   * playback.
   */
  async play(): Promise<void> {
    this.wantsPlay = true;
    if (this.index === null) return;
    await this.manager.play();
  }

  pause(): void {
    this.wantsPlay = false;
    for (const m of this.managers) m.pause();
  }

  setVolume(v: number): void {
    this.volume = v;
    for (const m of this.managers) m.setVolume(v);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    for (const manager of this.managers) manager.setMuted(m);
  }

  /**
   * Required by NarrationClock; the internal catch-up (see seekMs) already
   * drives the active element's tempo. An external caller has no reason to
   * force one today, but the interface must stay complete.
   */
  setPlaybackRate(rate: number): void {
    this.manager.setPlaybackRate(rate);
  }

  /**
   * A player with no recording is not a usable clock: the loop then leaves it
   * alone instead of waiting for it.
   */
  isUsableClock(): boolean {
    return this.parts.length > 0;
  }

  isSeeking(): boolean {
    return this.manager.isSeeking();
  }

  destroy(): void {
    for (const m of this.managers) m.destroy();
  }
}
