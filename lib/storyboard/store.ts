import { create } from "zustand";
import { DEMO_FINAL_SEQUENCE } from "@/lib/demo-data";
import {
  ProjectParams,
  StoryboardPanel,
  WorkflowStep,
  workflowStepSchema,
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
import type { NarrationPart } from "@/lib/whiteboard-animation/audio/narration-schedule";
import { dataUrlToBlobUrl } from "@/lib/whiteboard-animation/audio/audio-serialization";
import { panelAudioSegments } from "./audio-segments";

/** The id of an image's audio media. */
function audioMediaId(panelKey: string): string {
  return `media-audio-${panelKey}`;
}
import type { TransitionType } from "@/lib/editor/types";

export interface MediaItem {
  id: string;
  url: string;
  prompt: string;
  duration: number;
  // Follows projectParams.aspectRatio, which covers the menu's three formats.
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
  transition?: { type: TransitionType; duration: number };
}

/**
 * What a recording says, word by word, with the instant of each.
 *
 * One entry per recording and not per image: the script goes out in one take,
 * so a single file carries several images.
 */
export interface NarrationTranscript {
  /** The transcribed recording, as the bucket serves it. */
  url: string;
  words: { word: string; startMs: number; endMs: number }[];
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
  // Neither aspectRatio nor resolution here: the ratio belongs to projectParams
  // (chosen at the Prompt step, a single source), and resolution is an
  // EXPORT choice — the preview always renders at 720 on the short side.
  annotations: Annotation[];
  annotationConfig: AnnotationConfig;
  audio: AudioTrack | null;
  /**
   * The voice as the pipeline produces it: one chunk per narration
   * beat, placed at its absolute start. It takes precedence over `audio`, which
   * remains the track of a manual upload and that of older projects.
   */
  narration: NarrationPart[];
  transcript: TranscriptCue[];
  /**
   * The transcription of the recordings.
   *
   * It was produced to realign the narration beats, then thrown away: the
   * slightest reuse — subtitles, a search in the voice — required
   * paying again for a transcription of the same audio.
   */
  transcription: NarrationTranscript[];
}

export interface StoryboardStoreState {
  step: WorkflowStep;
  projectTitle: string;
  promptContent: string;
  projectParams: ProjectParams;
  scriptTitle: string;
  scriptText: string;
  storyboardPanels: StoryboardPanel[];
  activeClipIndex: number;
  selectedVoice: string;
  isGenerating: boolean;
  whiteboardConfig: WhiteboardConfig;

  // Actions
  setStep: (step: WorkflowStep) => void;
  setProjectTitle: (title: string) => void;
  setPromptContent: (content: string) => void;
  setProjectParams: (params: Partial<ProjectParams>) => void;
  setScriptTitle: (title: string) => void;
  setScriptText: (text: string) => void;
  setStoryboardPanels: (panels: StoryboardPanel[]) => void;
  setActiveClipIndex: (index: number) => void;
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
  setNarrationParts: (parts: NarrationPart[]) => void;
  setTranscript: (cues: TranscriptCue[]) => void;
  setNarrationTranscription: (takes: NarrationTranscript[]) => void;
  linkTranscriptCue: (cueId: string, annotationId: string) => void;

  loadDemoData: () => void;
  resetWorkflow: () => void;

  // Selectors/Computed Helpers
  getMediaList: () => MediaItem[];
  getClipList: () => TimelineClip[];
}

const DEFAULT_PROJECT_PARAMS: ProjectParams = {
  visualStyle: "doodle",
  format: "explainer",
  aspectRatio: "16:9",
  language: "en",
  duration: "3-5 minutes",
  targetAudience: "general",
  tone: "professional",
};

export const DEFAULT_WHITEBOARD_CONFIG: WhiteboardConfig = {
  animStyle: "chunkjump",
  handStyle: "custom1",
  canvasBg: "white",
  annotations: [],
  annotationConfig: DEFAULT_ANNOTATION_CONFIG,
  audio: null,
  narration: [],
  transcript: [],
  transcription: [],
};

/**
 * An upload is persisted as a data: URL (a blob: URL is dead after a reload).
 * Rehydrate it into a fresh blob: URL so media elements get a short src.
 */
function deserializeAudioTrack(
  audio: AudioTrack | null
): AudioTrack | null {
  if (!audio) return null;

  // Remember what was stored: it is the only form that survives the next
  // reload, and the blob: below will not.
  const persistUrl = audio.persistUrl ?? audio.url;

  return {
    ...audio,
    persistUrl,
    url: dataUrlToBlobUrl(persistUrl),
  };
}

/**
 * Store the durable URL, never the runtime blob:.
 *
 * Hydration turns the saved data: URL into a fresh blob: for playback. Writing
 * the state back verbatim persisted THAT blob:, overwriting the data: original,
 * so the track was dead on the following load and unrecoverable after it.
 */
export function serializeAudioTrack(audio: AudioTrack | null): AudioTrack | null {
  if (!audio) return null;

  const { persistUrl, ...rest } = audio;
  // Only the durable URL is written, so it is not stored twice — a base64
  // narration is large enough to matter in localStorage.
  return { ...rest, url: persistUrl ?? audio.url };
}

/**
 * Maps a saved step to a step that still exists.
 *
 * "editor" and "editor-summary" were removed from the flow: a project
 * saved at those steps came back on a value matching no render
 * block, and the page showed up empty. Both came AFTER the
 * voice, so "whiteboard" — now the last step — preserves the intent.
 */
export function normalizeWorkflowStep(step: unknown): WorkflowStep {
  const parsed = workflowStepSchema.safeParse(step);
  if (parsed.success) return parsed.data;
  return step === "editor" || step === "editor-summary"
    ? "whiteboard"
    : "prompt";
}

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
    step: normalizeWorkflowStep(persisted?.step ?? currentState.step),
    whiteboardConfig: {
      ...currentState.whiteboardConfig,
      ...(persisted?.whiteboardConfig ?? {}),
      // Deserialize audio URL from data: back to blob:
      audio: persisted?.whiteboardConfig?.audio
        ? deserializeAudioTrack(persisted.whiteboardConfig.audio)
        : currentState.whiteboardConfig.audio,
    },
  };
}

/**
 * No local persistence: the project lives in the database, and lib/storyboard/
 * use-project-sync.ts does the round trip. Two competing copies of the same
 * document — one in localStorage, one in the database — diverged as soon as a
 * project was opened on another machine.
 */
export const useStoryboardStore = create<StoryboardStoreState>()(
  ((set, get) => ({
      step: "prompt",
      projectTitle: "Untitled Project",
      promptContent: "",
      projectParams: DEFAULT_PROJECT_PARAMS,
      scriptTitle: "",
      scriptText: "",
      storyboardPanels: [],
      activeClipIndex: 0,
      selectedVoice: "nova",
      isGenerating: false,
      whiteboardConfig: DEFAULT_WHITEBOARD_CONFIG,

      setStep: (step: WorkflowStep) => set({ step }),
      setProjectTitle: (projectTitle: string) => set({ projectTitle }),
      setPromptContent: (promptContent: string) => set({ promptContent }),
      setProjectParams: (params: Partial<ProjectParams>) =>
        set((state) => ({
          projectParams: { ...state.projectParams, ...params },
        })),
      setScriptTitle: (scriptTitle: string) => set({ scriptTitle }),
      setScriptText: (scriptText: string) => set({ scriptText }),
      setStoryboardPanels: (storyboardPanels: StoryboardPanel[]) =>
        set({ storyboardPanels }),
      setActiveClipIndex: (activeClipIndex: number) => set({ activeClipIndex }),
      updatePanel: (id: string, updates: Partial<StoryboardPanel>) =>
        set((state) => {
          const idx = state.storyboardPanels.findIndex((p) => p.id === id);
          if (idx === -1) return state;
          const panel = state.storyboardPanels[idx];
          const hasChanged = Object.entries(updates).some(
            ([k, val]) => (panel as Record<string, unknown>)[k] !== val,
          );
          if (!hasChanged) return state;
          const copy = [...state.storyboardPanels];
          copy[idx] = { ...panel, ...updates };
          return { storyboardPanels: copy };
        }),
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

      setNarrationParts: (narration: NarrationPart[]) =>
        set((state) => ({
          whiteboardConfig: { ...state.whiteboardConfig, narration },
        })),

      setTranscript: (cues: TranscriptCue[]) =>
        set((state) => ({
          whiteboardConfig: { ...state.whiteboardConfig, transcript: cues },
        })),

      setNarrationTranscription: (transcription: NarrationTranscript[]) =>
        set((state) => ({
          whiteboardConfig: { ...state.whiteboardConfig, transcription },
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
            annotations: (p as any).annotations,
            isGenerating: false,
          }),
        );

        set({
          projectTitle: "A Live-Action Flashback Scene",
          promptContent: DEMO_FINAL_SEQUENCE.masterDescription,
          scriptTitle: "A Live-Action Flashback Scene",
          scriptText: DEMO_FINAL_SEQUENCE.masterDescription,
          storyboardPanels: panels,
          selectedVoice: "nova",
          step: "whiteboard",
        });
      },

      resetWorkflow: () =>
        set({
          step: "prompt",
          projectTitle: "Untitled Project",
          promptContent: "",
          projectParams: DEFAULT_PROJECT_PARAMS,
          scriptTitle: "",
          scriptText: "",
          storyboardPanels: [],
          selectedVoice: "nova",
          isGenerating: false,
        }),

      getMediaList: () => {
        const state = get();
        const mediaList: MediaItem[] = [];
        const aspectRatio = state.projectParams.aspectRatio || "16:9";

        state.storyboardPanels.forEach((p: StoryboardPanel, i: number) => {
          const mediaUrl = p.videoUrl || p.imageUrl;
          if (mediaUrl) {
            mediaList.push({
              id: `media-video-${p.id || i}`,
              url: mediaUrl,
              prompt: p.prompt || p.visualPrompt || p.narration || "",
              duration: p.duration || 5,
              aspectRatio,
              status: "ready",
              type: p.videoUrl ? "video" : "image",
              resolution: { width: 1280, height: 720 },
            });
          }
          for (const segment of panelAudioSegments(p)) {
            mediaList.push({
              id: audioMediaId(p.id || `${i}`),
              url: segment.url,
              prompt: `Audio: ${p.prompt || p.narration || ""}`,
              duration: segment.durationSec,
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
          const mediaUrl = p.videoUrl || p.imageUrl;
          if (mediaUrl) {
            clips.push({
              speed: 1,
              id: `clip-${p.id || i}`,
              mediaId: `media-video-${p.id || i}`,
              trackId: "v1",
              start: startTime,
              duration: p.duration || 5,
              offset: 0,
            });
          }
          for (const segment of panelAudioSegments(p)) {
            const key = audioMediaId(p.id || `${i}`);
            clips.push({
              speed: 1,
              id: `audio-clip-${key}`,
              mediaId: key,
              trackId: "a1",
                start: startTime,
              duration: segment.durationSec,
              // Where to enter the file: several images share it, and
              // without this offset each would replay the start of the narration.
              offset: segment.offsetSec,
            });
          }
          startTime += p.duration || 5;
        });

        return clips;
      },
    })),
);
