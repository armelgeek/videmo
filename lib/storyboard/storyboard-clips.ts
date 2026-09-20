import type { ScriptBeat } from "./script-generation";
import type { StoryboardPanel } from "./schema";

/**
 * The editable shape of a clip at the Storyboard step.
 *
 * Distinct from StoryboardPanel: it carries `isSection`, which only exists in
 * the editor, and no image — that lives in a parallel array indexed the
 * same way.
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
  /** The voice of the whole image: it is spoken in one take. */
  audioUrl?: string;
  audioDurationMs?: number;
  /** Its narration beats, each carrying its own. */
  beats?: ScriptBeat[];
}

export interface StoryboardStepState {
  clips: EditableClip[];
  images: string[];
}

/**
 * Reopens the step from the saved panels.
 *
 * It is the only path that restores work already done: without it, a simple
 * reload restarted from the demo data, and the next keystroke
 * wrote them to the database over the real project.
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
      audioUrl: panel.audioUrl,
      audioDurationMs: panel.audioDurationMs,
      beats: panel.beats,
    })),
    images: panels.map((panel) => panel.imageUrl || ""),
  };
}


