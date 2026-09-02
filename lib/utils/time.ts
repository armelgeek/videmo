import type { TimelineClip, Annotation } from '@/lib/editor/types'

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }
  return `0:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

export function getAbsoluteAnnotationTime(
  clip: TimelineClip,
  annotationStartMs: number
): number {
  return clip.start + annotationStartMs / 1000
}

export function getAbsoluteAnnotationRange(
  clip: TimelineClip,
  annotation: Annotation
): { start: number; end: number } {
  const start = getAbsoluteAnnotationTime(clip, annotation.startMs)
  const end = start + annotation.durationMs / 1000
  return { start, end }
}
