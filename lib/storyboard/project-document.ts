import type { VideoProjectDocument } from "@/lib/video-project/schema";
import {
  DEFAULT_WHITEBOARD_CONFIG,
  type StoryboardStoreState,
  type WhiteboardConfig,
  normalizeWorkflowStep,
  serializeAudioTrack,
} from "./store";
import { projectParamsSchema } from "./schema";

/**
 * La part du store qui appartient au projet enregistre. Le reste de l'etat
 * (isGenerating, activeClipIndex) decrit l'ecran courant, pas le document.
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
 * Le corps d'un PATCH /api/video-projects/[id].
 *
 * `promptContent` et `selectedVoice` n'ont pas de colonne : ils voyagent dans
 * `params`, seul document libre que updateVideoProjectSchema accepte tel quel.
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
 * Une `data:` ou `blob:` URL fait echouer TOUT le PATCH en 400
 * (assertNoEphemeralUrl, app/api/video-projects/[id]/route.ts:74). Un panneau
 * dont l'image n'est pas encore hebergee ne doit pas emporter avec lui le
 * script et les annotations de la sauvegarde : on enregistre le panneau sans
 * son URL ephemere plutot que de perdre le tour entier.
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
        // imageUrl est requis par storyboardPanelSchema : la chaine vide passe
        // la validation la ou undefined la ferait echouer.
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
 * L'inverse : la ligne relue devient l'etat du store.
 *
 * Chaque champ retombe sur le defaut du store quand la ligne ne le porte pas,
 * pour qu'un projet cree avant l'ajout d'un champ s'ouvre quand meme.
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
    selectedVoice: typeof selectedVoice === "string" ? selectedVoice : "default",
    whiteboardConfig: {
      ...DEFAULT_WHITEBOARD_CONFIG,
      ...(project.whiteboardConfig ?? {}),
    } as WhiteboardConfig,
  };
}
