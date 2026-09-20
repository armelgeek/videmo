import type { VideoProjectDocument } from "@/lib/video-project/schema";
import {
  DEFAULT_WHITEBOARD_CONFIG,
  type StoryboardStoreState,
  type WhiteboardConfig,
  normalizeWorkflowStep,
  serializeAudioTrack,
} from "./store";
import { normalizeVoice } from "@/lib/speech/speech-generator";
import { projectParamsSchema } from "./schema";

/**
 * The part of the store that belongs to the saved project. The rest of the state
 * (isGenerating, activeClipIndex) describes the current screen, not the document.
 */
export type ProjectSlice = Pick<
  StoryboardStoreState,
  | "step"
  | "projectTitle"
  | "promptContent"
  | "projectParams"
  | "scriptTitle"
  | "scriptText"
  | "storyboardPanels"
  | "selectedVoice"
  | "whiteboardConfig"
>;

/**
 * The body of a PATCH /api/video-projects/[id].
 *
 * `promptContent` and `selectedVoice` have no column: they travel in
 * `params`, the only free-form document updateVideoProjectSchema accepts as-is.
 */
export interface ProjectPatch {
  title: string;
  step: string;
  aspectRatio: string;
  params: Record<string, unknown>;
  script: { title: string; text: string };
  panels: unknown[];
  whiteboardConfig: Record<string, unknown>;
}

/**
 * A `data:` or `blob:` URL fails the WHOLE PATCH with a 400
 * (assertNoEphemeralUrl, app/api/video-projects/[id]/route.ts:74). A panel
 * whose image is not hosted yet must not drag down the script and annotations
 * of the save with it: we save the panel without its ephemeral URL rather
 * than lose the whole round.
 */
const EPHEMERAL_URL = /^\s*(?:data|blob):/i;

function isEphemeral(value: unknown): boolean {
  return typeof value === "string" && EPHEMERAL_URL.test(value);
}

const PANEL_URL_FIELDS = [
  "imageUrl",
  "linkedImageUrl",
  "videoUrl",
  "audioUrl",
] as const;

export function stripEphemeralUrls(panels: unknown[]): unknown[] {
  return panels.map((panel) => {
    if (!panel || typeof panel !== "object") return panel;

    const copy: Record<string, unknown> = { ...(panel as object) };
    for (const field of PANEL_URL_FIELDS) {
      if (isEphemeral(copy[field])) {
        // imageUrl is required by storyboardPanelSchema: the empty string passes
        // validation where undefined would fail it.
        copy[field] = field === "imageUrl" ? "" : undefined;
      }
    }

    const annotations = copy.annotations;
    if (Array.isArray(annotations)) {
      copy.annotations = annotations.map((annotation) => {
        if (!annotation || typeof annotation !== "object") return annotation;
        const a: Record<string, unknown> = { ...(annotation as object) };
        for (const [key, value] of Object.entries(a)) {
          if (isEphemeral(value)) a[key] = undefined;
        }
        return a;
      });
    }

    return copy;
  });
}

export function toProjectPatch(slice: ProjectSlice): ProjectPatch {
  return {
    title: slice.projectTitle,
    step: slice.step,
    aspectRatio: slice.projectParams.aspectRatio,
    params: {
      ...slice.projectParams,
      promptContent: slice.promptContent,
      selectedVoice: slice.selectedVoice,
    },
    script: { title: slice.scriptTitle, text: slice.scriptText },
    panels: stripEphemeralUrls(slice.storyboardPanels),
    whiteboardConfig: {
      ...slice.whiteboardConfig,
      audio: serializeAudioTrack(slice.whiteboardConfig.audio),
    },
  };
}

export interface LoadedProject {
  title: string;
  step: string;
  params: Record<string, unknown>;
  script: { title?: string; text?: string };
  panels: unknown[];
  whiteboardConfig: Record<string, unknown>;
}

/**
 * The reverse: the reloaded row becomes the store state.
 *
 * Each field falls back to the store default when the row does not carry it,
 * so that a project created before a field was added still opens.
 */
export function fromLoadedProject(project: LoadedProject): ProjectSlice {
  const { promptContent, selectedVoice, ...params } = project.params ?? {};

  return {
    step: normalizeWorkflowStep(project.step),
    projectTitle: project.title,
    promptContent: typeof promptContent === "string" ? promptContent : "",
    projectParams: projectParamsSchema.parse(params ?? {}),
    scriptTitle: project.script?.title ?? "",
    scriptText: project.script?.text ?? "",
    storyboardPanels: (project.panels ?? []) as ProjectSlice["storyboardPanels"],
    // Saved projects carry old made-up identifiers
    // (en-us-male-1): passing them as-is would make synthesis fail.
    selectedVoice: normalizeVoice(selectedVoice),
    whiteboardConfig: {
      ...DEFAULT_WHITEBOARD_CONFIG,
      ...(project.whiteboardConfig ?? {}),
    } as WhiteboardConfig,
  };
}
