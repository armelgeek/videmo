import type { StoryboardPanel } from "./schema";
import type { ScriptScene } from "./script-generation";

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

/**
 * Amorce l'etape depuis le script approuve, quand aucun panneau n'existe
 * encore. Les visuels restent vides : ils ne sont produits que sur demande.
 */
export function scenesToStepState(
  scenes: ScriptScene[],
): StoryboardStepState {
  return {
    clips: scenes.map((scene, index) => ({
      id: `clip-${scene.index}`,
      index,
      clipType: scene.clipType,
      title: scene.title,
      summary: scene.narration,
      visualPrompt: scene.imagePrompt,
      duration: scene.duration,
      isSection: false,
    })),
    images: scenes.map(() => ""),
  };
}

/**
 * L'etat d'ouverture de l'etape Storyboard.
 *
 * Les panneaux priment sur le script : ils portent les visuels produits et les
 * retouches faites ici, que le script ne connait pas.
 */
export function resolveStepState(input: {
  panels: StoryboardPanel[];
  scenes: ScriptScene[];
}): StoryboardStepState {
  if (input.panels.length > 0) return panelsToStepState(input.panels);
  if (input.scenes.length > 0) return scenesToStepState(input.scenes);
  return { clips: [], images: [] };
}
