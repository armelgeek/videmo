import type { MediaItem, TimelineClip, Track } from "@/lib/editor/types";
import type { DerivedTimeline } from "./derive-timeline";
import { annotationColors } from "../schema";

export const ANNOTATION_TRACK_ID = "annotations";

export interface EditorTimelineView {
  tracks: Track[];
  clips: TimelineClip[];
  mediaMap: Record<string, MediaItem>;
  durationSeconds: number;
}

const toSeconds = (ms: number) => ms / 1000;

/**
 * Projects the derived timeline into the shape the NLE timeline expects:
 * milliseconds become seconds, and every annotation becomes a clip on a single
 * always-present track.
 *
 * `timeline-clip.tsx` reads `media.type`, so each annotation gets a synthetic
 * MediaItem — there is no real source media behind an annotation.
 */
export function toEditorTimeline(derived: DerivedTimeline): EditorTimelineView {
  const clips: TimelineClip[] = [];
  const mediaMap: Record<string, MediaItem> = {};

  // Same rank as on the canvas: counted within the annotation's own scene.
  const rankByScene = new Map<string, number>();

  for (const annotation of derived.annotations) {
    const duration = toSeconds(annotation.reveal.durationMs);
    const scene = annotation.id.match(/^p\d+-/)?.[0] ?? "";
    const rank = rankByScene.get(scene) ?? 0;
    rankByScene.set(scene, rank + 1);

    clips.push({
      id: annotation.id,
      mediaId: annotation.id,
      trackId: ANNOTATION_TRACK_ID,
      start: toSeconds(annotation.reveal.startMs),
      duration,
      offset: 0,
      speed: 1,
      color: annotationColors(annotation, rank).stroke,
    });

    mediaMap[annotation.id] = {
      id: annotation.id,
      url: "",
      prompt: annotation.text,
      duration,
      aspectRatio: "16:9",
      status: "ready",
      type: "image",
    };
  }

  return {
    tracks: [{ id: ANNOTATION_TRACK_ID, name: "Annotations", type: "video" }],
    clips,
    mediaMap,
    durationSeconds: toSeconds(derived.totalDurationMs),
  };
}
