"use client";

import type { MediaItem, TimelineClip, StoryboardPanel } from "./types";
import dynamic from "next/dynamic";
import { DEMO_FINAL_SEQUENCE } from "../demo-data";
import { Suspense } from "react";

const Editor = dynamic(
  () => import("./components/editor").then((mod) => mod.Editor),
  { ssr: false },
);

function createInitialData() {
  const storyboard = DEMO_FINAL_SEQUENCE.storyboard;
  console.log("Storyboard panels:", storyboard.length);
  console.log("First panel:", {
    duration: storyboard[0]?.duration,
    videoUrl: !!storyboard[0]?.videoUrl,
    audioUrl: !!storyboard[0]?.audioUrl,
  });

  const initialMedia: MediaItem[] = [];

  // Create video and audio media items
  storyboard.forEach((p, i) => {
    console.log(`Panel ${i}:`, { hasAudioUrl: !!p.audioUrl, audioUrl: p.audioUrl ? p.audioUrl.substring(0, 50) : "none" });

    // Video media
    initialMedia.push({
      id: `media-video-${i}`,
      url: p.videoUrl,
      prompt: p.prompt,
      duration: p.duration,
      aspectRatio: DEMO_FINAL_SEQUENCE.videoConfig.aspectRatio,
      status: "ready" as const,
      type: "video" as const,
      resolution: { width: 1280, height: 720 },
    });

    // Audio media
    if (p.audioUrl) {
      console.log(`Creating audio media for panel ${i}`);
      initialMedia.push({
        id: `media-audio-${i}`,
        url: p.audioUrl,
        prompt: `Audio: ${p.prompt}`,
        duration: p.duration,
        aspectRatio: DEMO_FINAL_SEQUENCE.videoConfig.aspectRatio,
        status: "ready" as const,
        type: "audio" as const,
        resolution: { width: 1280, height: 720 },
      });
    }
  });

  const initialClips: TimelineClip[] = [];
  let startTime = 0;

  DEMO_FINAL_SEQUENCE.storyboard.forEach((p, i) => {
    // Add video clip
    initialClips.push({
      speed: 1,
      id: `clip-${i}`,
      mediaId: `media-video-${i}`,
      trackId: "v1",
      start: startTime,
      duration: p.duration,
      offset: 0,
      transition: undefined,
    });

    // Add audio clip
    if (p.audioUrl) {
      initialClips.push({
        speed: 1,
        id: `audio-clip-${i}`,
        mediaId: `media-audio-${i}`,
        trackId: "a1",
        start: startTime,
        duration: p.duration,
        offset: 0,
        transition: undefined,
      });
    }

    startTime += p.duration;
  });

  const initialStoryboard: StoryboardPanel[] = DEMO_FINAL_SEQUENCE.storyboard.map(
    (p, i) => ({
      id: `sb-${i}`,
      prompt: p.prompt,
      imageUrl: p.imageUrl,
      linkedImageUrl: p.linkedImageUrl,
      videoUrl: p.videoUrl,
      mediaId: `media-${i}`,
      status: "idle" as const,
      type: p.linkedImageUrl ? ("transition" as const) : ("scene" as const),
      duration: p.duration as 5 | 8,
    }),
  );

  console.log("Initial Data:", {
    mediaCount: initialMedia.length,
    audioMediaCount: initialMedia.filter(m => m.type === "audio").length,
    clipsCount: initialClips.length,
    audioClipsCount: initialClips.filter(c => c.trackId === "a1").length,
    audioClips: initialClips.filter(c => c.trackId === "a1").map(c => ({ id: c.id, mediaId: c.mediaId })),
  });

  return { initialMedia, initialClips, initialStoryboard };
}

function EditorContent() {
  const data = createInitialData();

  return (
    <div className="h-screen w-screen overflow-hidden">
      <Editor
        initialStoryboard={data.initialStoryboard}
        initialMedia={data.initialMedia}
        initialClips={data.initialClips}
        onBack={() => window.history.back()}
      />
    </div>
  );
}

function App() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-[var(--surface-0)] text-white">
          Loading editor...
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}

export default App;
