import type { Annotation } from "@/lib/unified-engine/types";

/**
 * Ramene le debut du trace d'un clip a zero.
 *
 * Une sequence de clip porte le meme modele que la sequence globale : chaque
 * annotation attend `gapBeforeMs` apres la precedente. Mais la PREMIERE n'a
 * rien devant elle a l'interieur du clip — son attente mesure la distance
 * depuis le clip d'avant, sur l'horloge globale.
 *
 * Gardee telle quelle, cette attente etait comptee deux fois : le moteur
 * restait sur un fond vide pendant sa duree (le blanc au debut du clip), et la
 * duree totale du trace depassait la fenetre du clip d'autant, si bien que le
 * dessin se faisait couper avant d'etre acheve. Mesure sur cinq clips reels :
 * `duree du trace - attente initiale` vaut exactement la longueur de la
 * fenetre.
 *
 * Les intervalles ENTRE annotations sont laisses intacts : eux separent bien
 * deux traces a l'interieur du clip.
 */
export function sansAttenteInitiale(annotations: Annotation[]): Annotation[] {
  const premiere = annotations[0];
  if (!premiere?.reveal.gapBeforeMs) return annotations;
  return [
    { ...premiere, reveal: { ...premiere.reveal, gapBeforeMs: 0 } },
    ...annotations.slice(1),
  ];
}
