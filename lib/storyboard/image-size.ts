import type { ImageSize } from "./annotation-planning";

/**
 * La taille par defaut d'une illustration produite : celle que rend le moteur
 * en 16:9. Elle sert quand l'image ne peut pas etre mesuree, plutot que de
 * renoncer a planifier les annotations.
 */
export const DEFAULT_IMAGE_SIZE: ImageSize = { width: 1536, height: 1024 };

/**
 * Mesure une image, dans le navigateur.
 *
 * Les regions rendues par la vision sont en pixels de l'image : sans sa taille
 * reelle, on ne peut ni les borner ni les ramener dans le repere du canvas. La
 * supposer revient a decaler chaque rectangle des que le moteur rend un autre
 * format.
 *
 * Une image illisible — adresse morte, bac inaccessible — rend la taille par
 * defaut : une region approximative reste ajustable dans l'editeur, alors
 * qu'une scene sans annotation ne se dessine pas du tout.
 */
export function measureImageSize(url: string): Promise<ImageSize> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined" || !url) {
      resolve(DEFAULT_IMAGE_SIZE);
      return;
    }

    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || DEFAULT_IMAGE_SIZE.width,
        height: image.naturalHeight || DEFAULT_IMAGE_SIZE.height,
      });
    image.onerror = () => resolve(DEFAULT_IMAGE_SIZE);
    image.src = url;
  });
}
