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
    this.el.src = url;
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
