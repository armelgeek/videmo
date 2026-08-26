import { VideoModel } from "./schema";

export type { VideoModel };

export interface StoryboardPanelData {
  id: string;
  imageUrl: string;
  linkedImageUrl?: string; // If set, this panel uses first-last frame video generation
  prompt: string;
  duration: 3 | 5 | 8;
  videoUrl?: string;
  isGenerating: boolean;
  error?: string;
  model?: VideoModel;
}

export interface VideoConfig {
  aspectRatio: "16:9" | "9:16";
  useFastModel: boolean;
}

export interface StoryboardState {
  panels: StoryboardPanelData[];
}
