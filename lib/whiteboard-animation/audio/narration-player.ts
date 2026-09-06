import { AudioManager } from "./audio-manager";
import {
  type NarrationPart,
  nextNarrationAction,
  narrationEndMs,
} from "./narration-schedule";

/**
 * Joue la narration produite temps par temps, en presentant l'interface d'UNE
 * piste continue.
 *
 * La boucle de rendu raisonne sur l'horloge du PROJET : elle demande la
 * position courante, et recale quand le son derive. Ici cette position est
 * traduite en « quel morceau, a quel endroit », si bien que la boucle n'a pas
 * a savoir que la voix est decoupee.
 *
 * La decision vit dans `nextNarrationAction`, testee seule : jsdom
 * n'implemente ni `play` ni `load`, donc ce lecteur ne se prouve pas
 * directement. Il ne fait qu'executer.
 */
export class NarrationPlayer {
  private manager = new AudioManager();
  private index: number | null = null;
  private voulu = false;

  constructor(private parts: NarrationPart[]) {}

  /** L'element sous-jacent — pour les ecouteurs de chargement, comme AudioManager. */
  getElement(): HTMLAudioElement {
    return this.manager.getElement();
  }

  /** Toute la narration, du debut du premier temps a la fin du dernier. */
  getDurationMs(): number {
    return narrationEndMs(this.parts);
  }

  /**
   * La position sur l'horloge du PROJET, et non dans le morceau courant.
   *
   * Pendant un trou aucun morceau n'est charge : on rend la fin du dernier
   * morceau joue, la seule position dont on soit sur.
   */
  getCurrentMs(): number {
    if (this.index === null) return 0;
    const part = this.parts[this.index];
    return part.startMs + this.manager.getCurrentMs();
  }

  /**
   * Se placer a cet instant du projet : changer de morceau s'il le faut, se
   * recaler sinon, se taire dans un trou.
   */
  seekMs(positionMs: number): void {
    const offsetMs =
      this.index === null ? 0 : this.manager.getCurrentMs();

    const action = nextNarrationAction(
      { index: this.index, offsetMs },
      this.parts,
      positionMs,
    );

    if (action.type === "rien") return;

    if (action.type === "taire") {
      this.manager.pause();
      this.index = null;
      return;
    }

    if (action.type === "charger") {
      this.index = action.index;
      void this.manager.load(action.part.url);
      this.manager.seekMs(action.offsetMs);
      if (this.voulu) {
        this.manager.play().catch((error) => {
          console.error("Failed to start narration playback:", error);
        });
      }
      return;
    }

    this.manager.seekMs(action.offsetMs);
  }

  /**
   * Suivre l'horloge du projet, a chaque frame.
   *
   * Sans cet appel, changer de temps attendrait que la boucle CONSTATE une
   * derive : le morceau precedent finit, sa position cesse d'avancer, et le
   * silence dure jusqu'au seuil de recalage. Ici la bascule tombe pile.
   */
  follow(positionMs: number): void {
    this.seekMs(positionMs);
  }

  /**
   * Demarrer. Sans morceau charge — le projet commence par un trou — on note
   * seulement l'intention : le prochain `seekMs` qui tombe sur un temps
   * lancera la lecture.
   */
  async play(): Promise<void> {
    this.voulu = true;
    if (this.index === null) return;
    await this.manager.play();
  }

  pause(): void {
    this.voulu = false;
    this.manager.pause();
  }

  setVolume(v: number): void {
    this.manager.setVolume(v);
  }

  setMuted(m: boolean): void {
    this.manager.setMuted(m);
  }

  /**
   * Un lecteur sans aucun morceau n'est pas une horloge utilisable : la boucle
   * le laisse alors tranquille au lieu de l'attendre.
   */
  isUsableClock(): boolean {
    return this.parts.length > 0;
  }

  destroy(): void {
    this.manager.destroy();
  }
}
