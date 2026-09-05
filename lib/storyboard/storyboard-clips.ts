import type { StoryboardPanel } from "./schema";

/**
 * La forme editable d'un clip a l'etape Storyboard.
 *
 * Distincte de StoryboardPanel : elle porte `isSection`, qui n'existe que dans
 * l'editeur, et pas d'image — celle-ci vit dans un tableau parallele indexe de
 * la meme facon.
 */
export interface EditableClip {
  id: string;
  index: number;
  clipType: string;
  title: string;
  summary: string;
  visualPrompt: string;
  duration: number;
  isSection: boolean;
}

export interface StoryboardStepState {
  clips: EditableClip[];
  images: string[];
}

/**
 * Rouvre l'etape a partir des panneaux enregistres.
 *
 * C'est le seul chemin qui rend le travail deja fait : sans lui, un simple
 * rechargement repartait des donnees de demonstration, et la premiere frappe
 * suivante les ecrivait en base par-dessus le vrai projet.
 */
export function panelsToStepState(
  panels: StoryboardPanel[],
): StoryboardStepState {
  return {
    clips: panels.map((panel, index) => ({
      id: panel.id || `clip-${index}`,
      index,
      clipType: panel.clipType || "content",
      title: panel.title || `Clip ${index + 1}`,
      summary: panel.narration || panel.prompt || "",
      visualPrompt: panel.visualPrompt || panel.prompt || "",
      duration: typeof panel.duration === "number" ? panel.duration : 5,
      isSection: false,
    })),
    images: panels.map((panel) => panel.imageUrl || ""),
  };
}


