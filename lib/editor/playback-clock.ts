"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * L'horloge de lecture, tenue HORS du cycle de rendu React.
 *
 * POURQUOI
 * La position de lecture change a chaque frame. Tant qu'elle vivait dans un
 * useState de l'editeur, chaque avance rendait tout ce qui pend sous lui —
 * la timeline et ses dizaines de clips, l'apercu, les dialogues — a la cadence
 * de la boucle. Meme ramenee a 30 Hz, c'est un rendu complet de l'editeur 30
 * fois par seconde pour deplacer un curseur de quelques pixels.
 *
 * COMMENT
 * La valeur vit ici, dans un module. Qui en a besoin s'abonne, et seul
 * l'abonne se rend : le curseur, la reglette, l'incrustation de texte. Qui n'en
 * a besoin qu'au moment d'agir — poser un marqueur, couper un clip, un
 * raccourci clavier — la LIT au moment ou il agit, sans s'abonner du tout.
 *
 * C'est le meme parti que `onViewportChange` dans la timeline, qui remet le
 * defilement a l'appelant plutot que de le pousser dans l'etat React : une
 * valeur qui change a la frame ne traverse pas le rendu.
 */

let position = 0;
const abonnes = new Set<() => void>();

/** La position courante, en secondes. Lecture ponctuelle, sans abonnement. */
export function lirePositionLecture(): number {
  return position;
}

/**
 * Pose la position et reveille les abonnes.
 *
 * Sans changement de valeur, personne n'est reveille : la boucle peut appeler
 * a chaque frame, une lecture en pause ne rend rien.
 */
export function poserPositionLecture(valeur: number): void {
  if (valeur === position) return;
  position = valeur;
  for (const abonne of abonnes) abonne();
}

/**
 * S'abonner aux avances de l'horloge. Rend la fonction de desabonnement.
 * Exporte parce que tout n'est pas un composant : un effet ou une couche
 * dessinee imperativement s'y branche de la meme facon.
 */
export function abonnerPositionLecture(surChangement: () => void): () => void {
  abonnes.add(surChangement);
  return () => {
    abonnes.delete(surChangement);
  };
}

/**
 * S'abonner a l'horloge. Le composant qui appelle ceci se rend a chaque
 * avance : a reserver aux feuilles — un curseur, un compteur — jamais a un
 * composant qui porte un sous-arbre.
 */
export function usePositionLecture(): number {
  return useSyncExternalStore(
    abonnerPositionLecture,
    lirePositionLecture,
    lirePositionLecture,
  );
}

/**
 * S'abonner a une valeur DERIVEE de l'horloge, en ne se rendant que lorsque
 * cette valeur change.
 *
 * Le cas type est « quel clip est sous le curseur » : la position change a
 * chaque frame, la reponse quelques fois par minute. `choisir` doit rendre une
 * valeur comparable par identite — une primitive, ou un objet deja stable
 * comme un element du tableau de clips.
 */
export function useValeurALaPosition<T>(choisir: (positionMs: number) => T): T {
  const lire = useCallback(() => choisir(position), [choisir]);
  return useSyncExternalStore(abonnerPositionLecture, lire, lire);
}
