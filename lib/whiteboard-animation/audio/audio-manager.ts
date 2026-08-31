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

  constructor() {
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

  seekMs(ms: number): void {
    this.el.currentTime = ms / 1000;
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
    return this.el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !this.el.error;
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
