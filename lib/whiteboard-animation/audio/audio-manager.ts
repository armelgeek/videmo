/**
 * Wraps a single HTMLAudioElement. All time values crossing this boundary
 * are milliseconds — HTMLAudioElement.currentTime/duration are seconds, and
 * the conversion happens exactly once, here, so no caller has to remember it.
 */
export class AudioManager {
  private el: HTMLAudioElement;
  private timeListeners = new Set<(ms: number) => void>();
  private boundTimeUpdate: () => void;
  private boundLoadedMetadata: () => void;
  private durationMs = 0;

  /**
   * A load or playback failure, so a caller can show it to the user.
   * Without this, a missing recording (404, network) only left a
   * `console.error` line — the voice was missing without any explanation
   * reaching the screen.
   */
  constructor(private onError: (message: string) => void = () => {}) {
    this.el = new Audio();
    this.boundTimeUpdate = () => {
      const ms = this.el.currentTime * 1000;
      for (const cb of this.timeListeners) cb(ms);
    };
    this.boundLoadedMetadata = () => {
      this.durationMs = this.el.duration * 1000;
    };
    this.el.addEventListener("timeupdate", this.boundTimeUpdate);
    this.el.addEventListener("loadedmetadata", this.boundLoadedMetadata);
  }

  /** Exposed for testing only — production callers use the methods below. */
  getElement(): HTMLAudioElement {
    return this.el;
  }

  async load(url: string): Promise<void> {
    if (!url) {
      throw new Error('Audio URL is empty');
    }
    this.el.src = url;
    // Set error handler before loading
    const errorHandler = () => {
      console.error(`Failed to load audio from: ${url}`, this.el.error);
      this.onError(`Failed to load narration audio (${url.split("/").pop()}).`);
    };
    this.el.addEventListener('error', errorHandler, { once: true });
    this.el.load();
  }

  async play(): Promise<void> {
    await this.el.play();
  }

  pause(): void {
    this.el.pause();
  }

  /**
   * Follow the project clock. A single track has nothing to follow: its
   * position IS the project's. The method exists so the per-beat player can
   * switch parts on the same call.
   */
  follow(_positionMs: number): void {}

  seekMs(ms: number): void {
    this.el.currentTime = ms / 1000;
  }

  /**
   * Catch up a small gap smoothly, without a cut: play slightly faster or
   * slower rather than jump. A jump cuts and resumes, which is audible; a
   * barely changed tempo goes unnoticed, and beats an audible glitch for a
   * gap that a few seconds of playback are enough to absorb.
   */
  setPlaybackRate(rate: number): void {
    if (this.el.playbackRate !== rate) this.el.playbackRate = rate;
  }

  getPlaybackRate(): number {
    return this.el.playbackRate;
  }

  /**
   * A seek is in progress: the element has not finished repositioning yet.
   *
   * Used by the multi-track player to NOT request another seek until the
   * previous one has completed — without this guard, a stream not yet
   * buffered always stays "late" while it catches up, and every frame
   * started a new seek before the first had time to load. The voice never
   * settled.
   */
  isSeeking(): boolean {
    return this.el.seeking;
  }

  setVolume(v: number): void {
    this.el.volume = Math.max(0, Math.min(1, v));
  }

  setMuted(m: boolean): void {
    this.el.muted = m;
  }

  getCurrentMs(): number {
    return this.el.currentTime * 1000;
  }

  /**
   * True once the element holds enough data for currentTime to actually
   * advance. A stalled load leaves readyState at HAVE_NOTHING without ever
   * firing `error`, so callers that drive timing from this clock must check
   * here rather than assume a loaded manager is a running clock.
   */
  isUsableClock(): boolean {
    return (
      this.el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      !this.el.error &&
      !this.el.ended &&
      // Mid-seek the position is in flux and briefly reports the target
      // rather than what is playing. Reading it as a clock makes the caller
      // chase a value that is about to change under it.
      !this.el.seeking
    );
  }

  getDurationMs(): number {
    return this.durationMs;
  }

  onTimeUpdate(cb: (ms: number) => void): () => void {
    this.timeListeners.add(cb);
    return () => this.timeListeners.delete(cb);
  }

  destroy(): void {
    this.el.pause();
    this.timeListeners.clear();
    this.el.removeEventListener("timeupdate", this.boundTimeUpdate);
    this.el.removeEventListener("loadedmetadata", this.boundLoadedMetadata);
  }
}
