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
  const initialMedia: MediaItem[] = DEMO_FINAL_SEQUENCE.storyboard.map((p, i) => ({
    id: `media-${i}`,
    url: p.videoUrl,
    prompt: p.prompt,
    duration: p.duration,
    aspectRatio: DEMO_FINAL_SEQUENCE.videoConfig.aspectRatio,
    status: "ready" as const,
    type: "video" as const,
    resolution: { width: 1280, height: 720 },
  }));

  const initialClips: TimelineClip[] = [];
  let startTime = 0;

  initialMedia.forEach((m, i) => {
    // Add video clip
    initialClips.push({
      speed: 1,
      id: `clip-${i}`,
      mediaId: m.id,
      trackId: "v1",
      start: startTime,
      duration: m.duration,
      offset: 0,
      transition: undefined,
    });

    // Add audio clip from the same media
    initialClips.push({
      speed: 1,
      id: `audio-clip-${i}`,
      mediaId: m.id,
      trackId: "a1",
      start: startTime,
      duration: m.duration,
      offset: 0,
      transition: undefined,
    });

    startTime += m.duration;
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
