/**
 * Retrouver chaque temps de narration DANS un enregistrement continu.
 *
 * La voix se produisait temps par temps, pour connaitre la duree de chacun.
 * C'etait resoudre un probleme de mesure par un decoupage de production : trois
 * defauts en decoulaient — une concatenation, un melange, et la fin de chaque
 * temps rognee a la bascule — plus un quatrieme, silencieux : un TTS relance a
 * chaque phrase repart a zero, sans liaison ni elan.
 *
 * On enregistre donc d'une traite, et on retrouve les temps par la
 * transcription. Le texte de chaque temps est connu — il vient du script, mot
 * pour mot — donc il ne s'agit pas de comprendre, seulement de recaler.
 */

export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface AlignedBeat {
  /** Debut du temps dans l'enregistrement. */
  startMs: number;
  /**
   * Ce que le temps OCCUPE : jusqu'au debut du suivant, silence compris.
   *
   * Et non `fin - debut` : `deriveTimeline` enchaine les annotations sur leurs
   * durees, donc rendre la duree parlee laisserait les pauses de cote et le
   * dessin prendrait de l'avance a chaque respiration.
   */
  durationMs: number;
  /** La fin de la parole, pour qui veut la vraie duree dite. */
  spokenEndMs: number;
}

/**
 * Reduit un mot a ce qui se compare : sans casse, sans accent, sans
 * ponctuation. La transcription rend « c'est » la ou le script ecrit
 * « C'est, », et « 2 » la ou il ecrit « deux » — le premier ecart se rattrape
 * ici, le second ne se rattrape pas et c'est pourquoi l'alignement tolere de
 * ne pas retomber sur ses pieds.
 */
export function normalizeToken(mot: string): string {
  return mot
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Les mots d'un texte, reduits et vides ecartes. */
export function tokenize(texte: string): string[] {
  return texte.split(/\s+/).map(normalizeToken).filter(Boolean);
}

/**
 * Combien de mots on accepte de chercher autour de la position attendue.
 *
 * La transcription ne rend pas exactement les mots du script : elle colle
 * parfois deux mots, en ecrit un en chiffres, en oublie un. Sans fenetre,
 * l'erreur d'un mot decalerait TOUS les temps suivants.
 */
const FENETRE = 4;

/**
 * Place chaque temps sur l'enregistrement.
 *
 * Les temps couvrent le script dans l'ordre et sans trou : on avance donc dans
 * la transcription en consommant, pour chaque temps, autant de mots qu'il en
 * compte — puis on corrige localement en cherchant son DERNIER mot autour de la
 * position atteinte.
 *
 * Un temps qu'on ne retrouve pas garde la place que son compte de mots lui
 * donne : mieux vaut un temps approximatif qu'un alignement qui deraille.
 */
export function alignBeats(input: {
  beats: { narration: string }[];
  words: TranscriptWord[];
  /** Fin de l'enregistrement, pour borner le dernier temps. */
  audioDurationMs: number;
}): AlignedBeat[] {
  const { words, audioDurationMs } = input;
  if (words.length === 0 || input.beats.length === 0) return [];

  const bornes: { debut: number; fin: number }[] = [];
  let curseur = 0;

  for (const beat of input.beats) {
    const jetons = tokenize(beat.narration);
    const debutIdx = Math.min(curseur, words.length - 1);

    let finIdx = Math.min(curseur + jetons.length - 1, words.length - 1);

    // Correction locale : le dernier mot du temps devrait se lire ici. S'il
    // est un peu plus loin ou un peu avant, on suit le texte plutot que le
    // compte.
    const dernier = jetons[jetons.length - 1];
    if (dernier) {
      for (let d = 0; d <= FENETRE; d++) {
        const avant = finIdx - d;
        const apres = finIdx + d;
        if (avant >= debutIdx && normalizeToken(words[avant]?.word ?? "") === dernier) {
          finIdx = avant;
          break;
        }
        if (apres < words.length && normalizeToken(words[apres]?.word ?? "") === dernier) {
          finIdx = apres;
          break;
        }
      }
    }

    bornes.push({ debut: debutIdx, fin: Math.max(finIdx, debutIdx) });
    curseur = Math.max(finIdx + 1, debutIdx + 1);
  }

  return bornes.map((borne, i) => {
    // Le premier temps part de ZERO, et non du premier mot : l'enregistrement
    // commence souvent par une respiration. La laisser dehors faisait partir
    // le dessin en avance de tout ce silence — 680 ms mesurees sur une image.
    // Les temps couvrent ainsi l'enregistrement exactement.
    const startMs = i === 0 ? 0 : words[borne.debut].startMs;
    const spokenEndMs = words[borne.fin].endMs;
    // Le temps occupe jusqu'au debut du suivant : la respiration entre deux
    // phrases appartient au temps qui la precede, sinon le dessin la devance.
    const suivant = bornes[i + 1];
    const durationMs =
      (suivant ? words[suivant.debut].startMs : audioDurationMs) - startMs;

    return { startMs, durationMs: Math.max(1, durationMs), spokenEndMs };
  });
}
