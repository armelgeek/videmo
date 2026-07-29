import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEMO_FINAL_SEQUENCE } from "@/lib/demo-data";
import {
  ProjectParams,
  StoryboardPanel,
  WorkflowStep,
} from "./schema";
import {
  Annotation,
  AnnotationConfig,
  DEFAULT_ANNOTATION_CONFIG,
} from "@/lib/whiteboard-animation/schema";
import type {
  AudioTrack,
  TranscriptCue,
} from "@/lib/whiteboard-animation/audio/types";

export interface MediaItem {
  id: string;
  url: string;
  prompt: string;
  duration: number;
  // Suit projectParams.aspectRatio, qui couvre les trois formats du menu.
  aspectRatio: "16:9" | "9:16" | "1:1";
  status: "ready" | "generating" | "error";
  type: "video" | "audio" | "image";
  resolution: { width: number; height: number };
}

export interface TimelineClip {
  speed: number;
  id: string;
  mediaId: string;
  trackId: string;
  start: number;
  duration: number;
  offset: number;
  transition?: unknown;
}

export interface WhiteboardConfig {
  animStyle: string;
  handStyle: string;
  canvasBg: string;
  // Legacy fields kept for backward compatibility with saved projects.
  // These are ignored at runtime but preserved when loading old projects.
  // Zustand merges persisted state, so old projects won't break.
  revealSpeed?: number;
  handSpeed?: number;
  chunks?: number;
  useAnnotation?: boolean;
  // Ni aspectRatio ni resolution ici : le ratio appartient a projectParams
  // (choisi des l'etape Prompt, une seule source), et la resolution est un
  // choix d'EXPORT — l'apercu rend toujours au petit cote 720.
  annotations: Annotation[];
  annotationConfig: AnnotationConfig;
  audio: AudioTrack | null;
  transcript: TranscriptCue[];
}

export interface StoryboardStoreState {
  step: WorkflowStep;
  projectTitle: string;
  promptContent: string;
  projectParams: ProjectParams;
  script: string;
  storyboardPanels: StoryboardPanel[];
  selectedVoice: string;
  isGenerating: boolean;
  whiteboardConfig: WhiteboardConfig;

  // Actions
  setStep: (step: WorkflowStep) => void;
  setProjectTitle: (title: string) => void;
  setPromptContent: (content: string) => void;
  setProjectParams: (params: Partial<ProjectParams>) => void;
  setScript: (script: string) => void;
  setStoryboardPanels: (panels: StoryboardPanel[]) => void;
  updatePanel: (id: string, updates: Partial<StoryboardPanel>) => void;
  setSelectedVoice: (voiceId: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setWhiteboardConfig: (config: Partial<WhiteboardConfig>) => void;

  // Annotation actions
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  setAnnotationConfig: (config: Partial<AnnotationConfig>) => void;
  setAudioTrack: (track: AudioTrack | null) => void;
  setTranscript: (cues: TranscriptCue[]) => void;
  linkTranscriptCue: (cueId: string, annotationId: string) => void;

  loadDemoData: () => void;
  resetWorkflow: () => void;

  // Selectors/Computed Helpers
  getMediaList: () => MediaItem[];
  getClipList: () => TimelineClip[];
}

const DEFAULT_PROJECT_PARAMS: ProjectParams = {
  style: "cinematic",
  format: "explainer",
  aspectRatio: "16:9",
  language: "en",
  duration: "3-5 minutes",
  targetAudience: "general",
  tone: "professional",
};

const DEFAULT_WHITEBOARD_CONFIG: WhiteboardConfig = {
  animStyle: "chunkjump",
  handStyle: "custom1",
  canvasBg: "white",
  annotations: [],
  annotationConfig: DEFAULT_ANNOTATION_CONFIG,
  audio: null,
  transcript: [],
};

/**
 * Zustand's default persist merge is shallow (`{ ...current, ...persisted }`):
 * a persisted `whiteboardConfig` object REPLACES the default wholesale, so a
 * field added after a project was saved (audio, transcript, or any future
 * field) comes back `undefined` instead of defaulting — this crashed
 * TranscriptPanel on `transcript.length` for any project saved before the
 * audio system existed. Merging `whiteboardConfig` one level deeper keeps new
 * fields defaulted until the user actually sets them.
 */
export function mergeStoryboardStorePersistedState(
  persistedState: unknown,
  currentState: StoryboardStoreState
): StoryboardStoreState {
  const persisted = persistedState as Partial<StoryboardStoreState> | undefined;
  return {
    ...currentState,
    ...persisted,
    whiteboardConfig: {
      ...currentState.whiteboardConfig,
      ...(persisted?.whiteboardConfig ?? {}),
    },
  };
}

export const useStoryboardStore = create<StoryboardStoreState>()(
  persist(
    (set, get) => ({
      step: "prompt",
      projectTitle: "Untitled Project",
      promptContent: "",
      projectParams: DEFAULT_PROJECT_PARAMS,
      script: "",
      storyboardPanels: [],
      selectedVoice: "default",
      isGenerating: false,
      whiteboardConfig: DEFAULT_WHITEBOARD_CONFIG,

      setStep: (step: WorkflowStep) => set({ step }),
      setProjectTitle: (projectTitle: string) => set({ projectTitle }),
      setPromptContent: (promptContent: string) => set({ promptContent }),
      setProjectParams: (params: Partial<ProjectParams>) =>
        set((state) => ({
          projectParams: { ...state.projectParams, ...params },
        })),
      setScript: (script: string) => set({ script }),
      setStoryboardPanels: (storyboardPanels: StoryboardPanel[]) =>
        set({ storyboardPanels }),
      updatePanel: (id: string, updates: Partial<StoryboardPanel>) =>
        set((state) => ({
          storyboardPanels: state.storyboardPanels.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        })),
      setSelectedVoice: (selectedVoice: string) => set({ selectedVoice }),
      setIsGenerating: (isGenerating: boolean) => set({ isGenerating }),
      setWhiteboardConfig: (config: Partial<WhiteboardConfig>) =>
        set((state) => ({
          whiteboardConfig: { ...state.whiteboardConfig, ...config },
        })),

      addAnnotation: (annotation: Annotation) =>
        set((state) => ({
          whiteboardConfig: {
            ...state.whiteboardConfig,
            annotations: [...state.whiteboardConfig.annotations, annotation],
          },
        })),

      updateAnnotation: (id: string, updates: Partial<Annotation>) =>
        set((state) => ({
          whiteboardConfig: {
            ...state.whiteboardConfig,
            annotations: state.whiteboardConfig.annotations.map((a) =>
              a.id === id ? { ...a, ...updates } : a,
            ),
          },
        })),

      removeAnnotation: (id: string) =>
        set((state) => ({
          whiteboardConfig: {
            ...state.whiteboardConfig,
            annotations: state.whiteboardConfig.annotations.filter(
              (a) => a.id !== id,
            ),
          },
        })),

      setAnnotations: (annotations: Annotation[]) =>
        set((state) => ({
          whiteboardConfig: {
            ...state.whiteboardConfig,
            annotations,
          },
        })),

      setAnnotationConfig: (config: Partial<AnnotationConfig>) =>
        set((state) => ({
          whiteboardConfig: {
            ...state.whiteboardConfig,
            annotationConfig: {
              ...state.whiteboardConfig.annotationConfig,
              ...config,
            },
          },
        })),

      setAudioTrack: (track: AudioTrack | null) =>
        set((state) => ({
          whiteboardConfig: { ...state.whiteboardConfig, audio: track },
        })),

      setTranscript: (cues: TranscriptCue[]) =>
        set((state) => ({
          whiteboardConfig: { ...state.whiteboardConfig, transcript: cues },
        })),

      linkTranscriptCue: (cueId: string, annotationId: string) =>
        set((state) => ({
          whiteboardConfig: {
            ...state.whiteboardConfig,
            transcript: state.whiteboardConfig.transcript.map((c) =>
              c.id === cueId ? { ...c, annotationId } : c
            ),
          },
        })),

      loadDemoData: () => {
        const panels: StoryboardPanel[] = DEMO_FINAL_SEQUENCE.storyboard.map(
          (p, i) => ({
            id: `sb-${i}`,
            imageUrl: p.imageUrl,
            linkedImageUrl: p.linkedImageUrl,
            prompt: p.prompt,
            duration: p.duration,
            videoUrl: p.videoUrl,
            audioUrl: p.audioUrl,
            isGenerating: false,
          }),
        );

        set({
          projectTitle: "A Live-Action Flashback Scene",
          promptContent: DEMO_FINAL_SEQUENCE.masterDescription,
          script: DEMO_FINAL_SEQUENCE.masterDescription,
          storyboardPanels: panels,
          selectedVoice: "en-us-male-1",
          step: "editor",
        });
      },

      resetWorkflow: () =>
        set({
          step: "prompt",
          projectTitle: "Untitled Project",
          promptContent: "",
          projectParams: DEFAULT_PROJECT_PARAMS,
          script: "",
          storyboardPanels: [],
          selectedVoice: "default",
          isGenerating: false,
        }),

      getMediaList: () => {
        const state = get();
        const mediaList: MediaItem[] = [];
        const aspectRatio = state.projectParams.aspectRatio || "16:9";

        state.storyboardPanels.forEach((p: StoryboardPanel, i: number) => {
          if (p.videoUrl) {
            mediaList.push({
              id: `media-video-${p.id || i}`,
              url: p.videoUrl,
              prompt: p.prompt,
              duration: p.duration,
              aspectRatio,
              status: "ready",
              type: "video",
              resolution: { width: 1280, height: 720 },
            });
          }
          if (p.audioUrl) {
            mediaList.push({
              id: `media-audio-${p.id || i}`,
              url: p.audioUrl,
              prompt: `Audio: ${p.prompt}`,
              duration: p.duration,
              aspectRatio,
              status: "ready",
              type: "audio",
              resolution: { width: 1280, height: 720 },
            });
          }
        });

        return mediaList;
      },

      getClipList: () => {
        const state = get();
        const clips: TimelineClip[] = [];
        let startTime = 0;

        state.storyboardPanels.forEach((p: StoryboardPanel, i: number) => {
          if (p.videoUrl) {
            clips.push({
              speed: 1,
              id: `clip-${p.id || i}`,
              mediaId: `media-video-${p.id || i}`,
              trackId: "v1",
              start: startTime,
              duration: p.duration,
              offset: 0,
            });
          }
          if (p.audioUrl) {
            clips.push({
              speed: 1,
              id: `audio-clip-${p.id || i}`,
              mediaId: `media-audio-${p.id || i}`,
              trackId: "a1",
              start: startTime,
              duration: p.duration,
              offset: 0,
            });
          }
          startTime += p.duration;
        });

        return clips;
      },
    }),
    {
      name: "storyboard-workflow-store",
      storage: createJSONStorage(() => sessionStorage),
      merge: mergeStoryboardStorePersistedState,
      partialize: (state: StoryboardStoreState) => ({
        step: state.step,
        projectTitle: state.projectTitle,
        promptContent: state.promptContent,
        projectParams: state.projectParams,
        script: state.script,
        storyboardPanels: state.storyboardPanels,
        selectedVoice: state.selectedVoice,
        whiteboardConfig: {
          animStyle: state.whiteboardConfig.animStyle,
          handStyle: state.whiteboardConfig.handStyle,
          canvasBg: state.whiteboardConfig.canvasBg,
          annotations: state.whiteboardConfig.annotations,
          annotationConfig: state.whiteboardConfig.annotationConfig,
          audio: state.whiteboardConfig.audio,
          transcript: state.whiteboardConfig.transcript,
        },
      }),
    },
  ),
);
