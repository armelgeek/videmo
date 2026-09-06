import { inkRegions } from "@/lib/image/ink-regions";
import type { InkCandidate } from "./annotation-planning";

/**
 * Au-dela, la liste soumise au modele devient une enumeration ou plus rien ne
 * se distingue. Les sujets sont tries par quantite d'encre : les premiers sont
 * ceux dont un temps de narration parle.
 */
const MAX_SUJETS = 8;

/**
 * Mesure les sujets dessines dans une image, depuis le navigateur.
 *
 * Le calcul se fait ici plutot que sur le serveur parce qu'il n'y demanderait
 * rien : le canvas decode l'image, la page l'a deja chargee pour la mesurer, et
 * aucune dependance nouvelle n'entre dans le projet.
 *
 * Une image illisible rend une liste vide, et la planification retombe alors
 * sur le rectangle devine par la vision.
 */
export async function measureInkCandidates(
  url: string,
  size: { width: number; height: number },
): Promise<InkCandidate[]> {
  if (typeof document === "undefined" || !url) return [];

  try {
    const image = await charger(url);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return [];
    context.drawImage(image, 0, 0, size.width, size.height);

    const { data } = context.getImageData(0, 0, size.width, size.height);
    const luminance = new Uint8Array(size.width * size.height);
    for (let i = 0; i < luminance.length; i++) {
      const p = i * 4;
      // Ponderation habituelle de la luminance : l'encre d'un whiteboard est
      // noire, mais le papier rendu porte un grain legerement colore.
      luminance[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
    }

    return inkRegions({ luminance, width: size.width, height: size.height })
      .slice(0, MAX_SUJETS)
      .map(({ x, y, width, height }) => ({ x, y, width, height }));
  } catch (error) {
    // Un canvas « teinte » par une image d'un autre domaine refuse
    // getImageData : la planification garde alors le rectangle devine.
    console.error("Could not measure the drawn subjects:", error);
    return [];
  }
}

function charger(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}
