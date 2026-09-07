import { AudioManager } from "./audio-manager";
import {
  type NarrationPart,
  nextNarrationAction,
  narrationEndMs,
} from "./narration-schedule";

/**
 * Joue la narration enregistrement par enregistrement, en presentant a la
 * boucle de rendu l'interface d'UNE piste continue.
 *
 * La boucle raisonne sur l'horloge du PROJET : elle demande la position
 * courante et recale quand le son derive. Ici cette position devient « quel
 * enregistrement, a quel endroit », si bien que la boucle n'a pas a savoir que
 * la voix vient de plusieurs fichiers.
 *
 * DEUX elements, et non un : charger au moment de basculer coutait un temps
 * mort mesure — trois chargements en 200 ms, et 65 ms de l'attaque suivante
 * sautees, parce que la boucle recalait la voix sur un dessin qui, lui,
 * n'attendait pas. Pendant qu'un element joue, l'autre prepare la suite ; la
 * bascule n'est plus qu'un echange.
 *
 * La decision vit dans `nextNarrationAction`, testee seule : jsdom n'implemente
 * ni `play` ni `load`, donc ce lecteur ne se prouve pas directement.
 */
export class NarrationPlayer {
  private managers = [new AudioManager(), new AudioManager()];
  /** Quel enregistrement chaque element porte, `null` s'il n'en porte aucun. */
  private porte: (number | null)[] = [null, null];
  private actif = 0;
  private index: number | null = null;
  private voulu = false;
  private volume = 1;
  private muet = false;
  /**
   * L'endroit vise, tant que la source n'est pas prete. Sans lui, la position
   * de l'element reste a zero pendant le chargement, l'ecart parait enorme, et
   * chaque frame redemande un recalage.
   */
  private attendu: number | null = null;

  constructor(private parts: NarrationPart[]) {}

  private get manager(): AudioManager {
    return this.managers[this.actif];
  }

  /**
   * Charge le premier enregistrement, et prepare le suivant.
   *
   * Sans cela le chargement commencait AU CLIC : le dessin partait pendant ce
   * temps et la boucle alignait ensuite la voix sur lui, en sautant ce qui
   * s'etait ecoule — 117 ms mesurees, soit l'attaque du premier mot perdue.
   */
  prepare(): void {
    if (this.parts.length === 0) return;
    this.actif = 0;
    this.index = 0;
    this.attendu = 0;
    this.charger(0, 0);
    this.preparerSuivant(0);
  }

  private charger(part: number, sur: number): void {
    if (this.porte[sur] === part) return;
    this.porte[sur] = part;
    void this.managers[sur].load(this.parts[part].url);
  }

  /** L'element libre prend l'enregistrement d'apres, pendant que l'autre joue. */
  private preparerSuivant(part: number): void {
    const suivant = part + 1;
    if (suivant >= this.parts.length) return;
    this.charger(suivant, 1 - this.actif);
  }

  getElement(): HTMLAudioElement {
    return this.manager.getElement();
  }

  /** Toute la narration, du debut du premier enregistrement a la fin du dernier. */
  getDurationMs(): number {
    return narrationEndMs(this.parts);
  }

  /** La position sur l'horloge du PROJET, et non dans l'enregistrement courant. */
  getCurrentMs(): number {
    if (this.index === null) return 0;
    return this.parts[this.index].startMs + this.manager.getCurrentMs();
  }

  /**
   * Se placer a cet instant du projet : echanger d'element s'il faut changer
   * d'enregistrement, se recaler sinon, se taire dans un trou.
   */
  seekMs(positionMs: number): void {
    const pret = this.manager.getElement().readyState > 0;
    const offsetMs =
      this.index === null
        ? 0
        : !pret && this.attendu !== null
          ? this.attendu
          : this.manager.getCurrentMs();
    if (pret) this.attendu = null;

    const action = nextNarrationAction(
      { index: this.index, offsetMs },
      this.parts,
      positionMs,
    );

    if (action.type === "rien") return;

    if (action.type === "taire") {
      this.manager.pause();
      this.index = null;
      this.attendu = null;
      return;
    }

    if (action.type === "charger") {
      // L'element qui ne joue pas porte deja la suite, en general : la bascule
      // n'est alors qu'un echange, sans chargement ni temps mort.
      const autre = 1 - this.actif;
      this.manager.pause();
      if (this.porte[autre] !== action.index) this.charger(action.index, autre);
      this.actif = autre;

      this.index = action.index;
      this.attendu = action.offsetMs;
      this.manager.setVolume(this.volume);
      this.manager.setMuted(this.muet);
      this.manager.seekMs(action.offsetMs);
      if (this.voulu) {
        this.manager.play().catch((error) => {
          console.error("Failed to start narration playback:", error);
        });
      }
      this.preparerSuivant(action.index);
      return;
    }

    this.attendu = action.offsetMs;
    this.manager.seekMs(action.offsetMs);
  }

  /** Suivre l'horloge du projet, a chaque frame. */
  follow(positionMs: number): void {
    this.seekMs(positionMs);
  }

  /**
   * Demarrer. Sans enregistrement charge — le projet commence par un trou — on
   * note seulement l'intention : le prochain `seekMs` qui tombe sur une voix
   * lancera la lecture.
   */
  async play(): Promise<void> {
    this.voulu = true;
    if (this.index === null) return;
    await this.manager.play();
  }

  pause(): void {
    this.voulu = false;
    for (const m of this.managers) m.pause();
  }

  setVolume(v: number): void {
    this.volume = v;
    for (const m of this.managers) m.setVolume(v);
  }

  setMuted(m: boolean): void {
    this.muet = m;
    for (const manager of this.managers) manager.setMuted(m);
  }

  /**
   * Un lecteur sans aucun enregistrement n'est pas une horloge utilisable : la
   * boucle le laisse alors tranquille au lieu de l'attendre.
   */
  isUsableClock(): boolean {
    return this.parts.length > 0;
  }

  destroy(): void {
    for (const m of this.managers) m.destroy();
  }
}
