import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEMO_FINAL_SEQUENCE } from "@/lib/demo-data";
import {
  ProjectParams,
  StoryboardPanel,
  WorkflowStep,
} from "./schema";

export interface MediaItem {
  id: string;
  url: string;
  prompt: string;
  duration: number;
  aspectRatio: "16:9" | "9:16";
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

export interface StoryboardStoreState {
  step: WorkflowStep;
  projectTitle: string;
  promptContent: string;
  projectParams: ProjectParams;
  script: string;
  storyboardPanels: StoryboardPanel[];
  selectedVoice: string;
  isGenerating: boolean;

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
      partialize: (state: StoryboardStoreState) => ({
        step: state.step,
        projectTitle: state.projectTitle,
        promptContent: state.promptContent,
        projectParams: state.projectParams,
        script: state.script,
        storyboardPanels: state.storyboardPanels,
        selectedVoice: state.selectedVoice,
      }),
    },
  ),
);
