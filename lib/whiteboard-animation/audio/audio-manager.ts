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
   * Un echec de chargement ou de lecture, pour qu'un appelant le montre a
   * l'utilisateur. Sans ca, un enregistrement introuvable (404, reseau) ne
   * laissait qu'une ligne en `console.error` — la voix manquait sans
   * qu'aucune explication n'atteigne l'ecran.
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
   * Suivre l'horloge du projet. Une piste unique n'a rien a suivre : sa
   * position EST celle du projet. La methode existe pour que le lecteur par
   * temps, lui, puisse changer de morceau au meme appel.
   */
  follow(_positionMs: number): void {}

  seekMs(ms: number): void {
    this.el.currentTime = ms / 1000;
  }

  /**
   * Rattraper un petit ecart en douceur, sans coupure : jouer legerement plus
   * vite ou plus lentement plutot que sauter. Un saut se coupe et se reprend,
   * ce qui s'entend ; un tempo a peine modifie ne se remarque pas, et vaut
   * mieux qu'un decrochage audible pour un ecart que quelques secondes de
   * lecture suffisent a resorber.
   */
  setPlaybackRate(rate: number): void {
    if (this.el.playbackRate !== rate) this.el.playbackRate = rate;
  }

  getPlaybackRate(): number {
    return this.el.playbackRate;
  }

  /**
   * Un saut est en cours : l'element n'a pas encore fini de se replacer.
   *
   * Utilise par le lecteur multi-pistes pour NE PAS redemander un saut tant
   * que le precedent n'a pas abouti — sans cette garde, un flux pas encore
   * mis en tampon reste toujours "en retard" pendant qu'il rattrape, et
   * chaque frame relancait un nouveau saut avant que le premier n'ait eu le
   * temps de charger. La voix ne finissait jamais de se stabiliser.
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
