"use client"

import type React from "react"

import { useState, useCallback, useMemo } from "react"
import type { TimelineClip, Track, MediaItem, StoryboardPanel } from "../types"

const INITIAL_TRACKS: Track[] = [
  { id: "v1", name: "Video 1", type: "video", volume: 1 },
  { id: "a1", name: "Audio 1", type: "audio", volume: 1 },
]

/**
 * One undo step.
 *
 * History used to hold only `timelineClips`. A Ctrl+Z after deleting a media
 * therefore resurrected clips whose `mediaId` no longer existed in `mediaMap`:
 * silent, invisible, and without any error. Tracks had the same gap.
 */
export interface TimelineSnapshot {
  clips: TimelineClip[]
  tracks: Track[]
  media: MediaItem[]
}

export interface UseTimelineStateOptions {
  initialMedia?: MediaItem[]
  initialClips?: TimelineClip[]
  initialStoryboard?: StoryboardPanel[]
  onPreviewStale?: () => void
}

export interface UseTimelineStateResult {
  // Media
  media: MediaItem[]
  setMedia: React.Dispatch<React.SetStateAction<MediaItem[]>>
  mediaMap: Record<string, MediaItem>

  // Tracks
  tracks: Track[]
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>

  // Clips
  timelineClips: TimelineClip[]
  setTimelineClips: React.Dispatch<React.SetStateAction<TimelineClip[]>>

  // Selection
  selectedClipIds: string[]
  setSelectedClipIds: React.Dispatch<React.SetStateAction<string[]>>
  selectionBounds: { start: number; end: number } | null

  // Tool
  tool: "select" | "razor"
  setTool: React.Dispatch<React.SetStateAction<"select" | "razor">>

  // Zoom
  zoomLevel: number
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>

  // Derived values
  contentDuration: number
  timelineDuration: number

  // History
  history: TimelineSnapshot[]
  future: TimelineSnapshot[]
  pushToHistory: () => void
  undo: () => void
  redo: () => void

  // Handlers
  handleClipUpdate: (id: string, chg: Partial<TimelineClip>) => void
  handleTrackUpdate: (id: string, chg: Partial<Track>) => void
  handleAddTrack: (type: "video" | "audio" | "text") => void
  handleReorderTracks: (trackIds: string[]) => void
  handleSelectClips: (ids: string[]) => void
  handleZoomChange: (zoom: number) => void
  handleAddToTimeline: (item: MediaItem) => void
  handleRemoveMedia: (item: MediaItem) => void
  handleSplitClip: (clipId: string, splitTime: number) => void
  handleDetachAudio: (clipId: string) => void
  handleDeleteClip: (clipIds: string[]) => void
  handleRippleDeleteClip: (clipIds: string[]) => void
  handleDuplicateClip: (clipIds: string[]) => void
  handleAddTextClip: (trackId: string, start: number) => void
  handleOverwriteClips: (movedClipIds: string[]) => void
  onToolChange: (newTool: "select" | "razor") => void
}

/**
 * Clip identifiers.
 *
 * `clip-${Date.now()}` collided as soon as two clips were created in the same
 * millisecond (multi-drop, rapid keyboard splits): duplicate React keys, and
 * handleClipUpdate modified both clips at once.
 */
let _clipSeq = 0
function newClipId(prefix: string) {
  _clipSeq += 1
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${rand}-${_clipSeq}`
}

export function useTimelineState({
  initialMedia,
  initialClips,
  initialStoryboard,
  onPreviewStale,
}: UseTimelineStateOptions): UseTimelineStateResult {
  // Media state
  const [media, setMedia] = useState<MediaItem[]>(initialMedia || [])
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS)
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>(initialClips || [])

  // History for undo/redo
  const [history, setHistory] = useState<TimelineSnapshot[]>([])
  const [future, setFuture] = useState<TimelineSnapshot[]>([])

  // UI state
  const [zoomLevel, setZoomLevel] = useState(40)
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([])
  const [tool, setTool] = useState<"select" | "razor">("select")

  // Derived values
  const mediaMap = useMemo(() => {
    return media.reduce((acc, item) => ({ ...acc, [item.id]: item }), {} as Record<string, MediaItem>)
  }, [media])

  const contentDuration = Math.max(0, ...timelineClips.map((c) => c.start + c.duration))
  const timelineDuration = Math.max(10, contentDuration + 2)

  const selectionBounds = useMemo(() => {
    if (selectedClipIds.length === 0) return null
    const selectedClips = timelineClips.filter((c) => selectedClipIds.includes(c.id))
    if (selectedClips.length === 0) return null
    const start = Math.min(...selectedClips.map((c) => c.start))
    const end = Math.max(...selectedClips.map((c) => c.start + c.duration))
    return { start, end }
  }, [selectedClipIds, timelineClips])

  const markPreviewStale = useCallback(() => {
    onPreviewStale?.()
  }, [onPreviewStale])

  // History actions
  const HISTORY_MAX = 100

  const snapshot = useCallback(
    (): TimelineSnapshot => ({ clips: timelineClips, tracks, media }),
    [timelineClips, tracks, media],
  )

  const restore = useCallback((snap: TimelineSnapshot) => {
    setTimelineClips(snap.clips)
    setTracks(snap.tracks)
    setMedia(snap.media)
  }, [])

  /**
   * `pushToHistory` is wired to a clip's mousedown (`onDragStart`), so a plain
   * selection click pushed an identical snapshot: it then took as many Ctrl+Z
   * as clicks to undo a single change. A state strictly identical to the top
   * of the stack is ignored.
   */
  const pushToHistory = useCallback(() => {
    const snap = snapshot()
    setHistory((prev) => {
      const top = prev[prev.length - 1]
      if (top && top.clips === snap.clips && top.tracks === snap.tracks && top.media === snap.media) {
        return prev
      }
      const next = [...prev, snap]
      return next.length > HISTORY_MAX ? next.slice(next.length - HISTORY_MAX) : next
    })
    setFuture([])
  }, [snapshot])

  const undo = useCallback(() => {
    if (history.length === 0) return
    const previousState = history[history.length - 1]
    setFuture((prev) => [snapshot(), ...prev])
    restore(previousState)
    setHistory(history.slice(0, -1))
  }, [history, snapshot, restore])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const nextState = future[0]
    setHistory((prev) => [...prev, snapshot()])
    restore(nextState)
    setFuture(future.slice(1))
  }, [future, snapshot, restore])

  // Clip/track handlers
  const handleClipUpdate = useCallback(
    (id: string, chg: Partial<TimelineClip>) => {
      setTimelineClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...chg } : c)))
      markPreviewStale()
    },
    [markPreviewStale],
  )

  const handleTrackUpdate = useCallback((id: string, chg: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...chg } : t)))
  }, [])

  const handleAddTrack = useCallback((type: "video" | "audio" | "text") => {
    setTracks((prev) => {
      const count = prev.filter((t) => t.type === type).length + 1
      const prefix = type === "video" ? "v" : type === "audio" ? "a" : "t"
      const newId = `${prefix}${Date.now()}`
      const typeName = type === "video" ? "Video" : type === "audio" ? "Audio" : "Text"
      return [
        ...prev,
        {
          id: newId,
          name: `${typeName} ${count}`,
          type,
          volume: 1,
        },
      ]
    })
  }, [])

  const handleReorderTracks = useCallback((trackIds: string[]) => {
    setTracks((prev) => {
      const trackMap = new Map(prev.map((t) => [t.id, t]))
      return trackIds.map((id) => trackMap.get(id)!).filter(Boolean)
    })
  }, [])

  const handleSelectClips = useCallback((ids: string[]) => {
    setSelectedClipIds(ids)
  }, [])

  const handleZoomChange = useCallback((zoom: number) => {
    setZoomLevel(zoom)
  }, [])

  const handleAddToTimeline = useCallback(
    (item: MediaItem) => {
      pushToHistory()
      const trackId = item.type === "audio" ? "a1" : "v1"
      const clipsOnTrack = timelineClips.filter((c) => c.trackId === trackId)
      const start = clipsOnTrack.length > 0 ? Math.max(...clipsOnTrack.map((c) => c.start + c.duration)) : 0
      const newClip: TimelineClip = {
        speed: 1,
        id: newClipId("clip"),
        mediaId: item.id,
        trackId,
        start,
        duration: item.duration,
        offset: 0,
        volume: 1,
      }
      setTimelineClips((prev) => [...prev, newClip])
      setSelectedClipIds([newClip.id])
      markPreviewStale()
    },
    [pushToHistory, timelineClips, markPreviewStale],
  )

  const handleRemoveMedia = useCallback(
    (item: MediaItem) => {
      const isUsed = timelineClips.some((c) => c.mediaId === item.id)
      if (isUsed) {
        if (!window.confirm("This media is used in the timeline. Removing it will delete associated clips. Continue?"))
          return
      }
      pushToHistory()
      const remaining = timelineClips.filter((c) => c.mediaId !== item.id)
      setTimelineClips(remaining)
      setMedia((prev) => prev.filter((m) => m.id !== item.id))
      // No URL.revokeObjectURL here: the media is now part of the undo
      // snapshot, and revoking the URL would break Ctrl+Z (restored clips
      // pointing at a dead blob). Blobs are released on page unload.
      // The selection is purged of DELETED clips. The check used to run on
      // `timelineClips`, the list from BEFORE the filter: it was true as soon
      // as a selection existed, so nothing was ever purged. The leftover ghost
      // ids then crashed the drag (initialStates[id] undefined).
      if (selectedClipIds.length > 0) {
        const survivors = selectedClipIds.filter((id) => remaining.some((c) => c.id === id))
        if (survivors.length !== selectedClipIds.length) setSelectedClipIds(survivors)
      }
    },
    [timelineClips, selectedClipIds, pushToHistory],
  )

  const handleSplitClip = useCallback(
    (clipId: string, splitTime: number) => {
      const clip = timelineClips.find((c) => c.id === clipId)
      if (!clip) return
      const relativeSplit = splitTime - clip.start
      const firstDuration = relativeSplit
      const secondDuration = clip.duration - relativeSplit
      // The guard runs BEFORE pushToHistory: a rejected split still pushed a
      // snapshot, and the next Ctrl+Z did nothing visible.
      if (firstDuration < 0.1 || secondDuration < 0.1) return
      pushToHistory()
      const clip1: TimelineClip = { ...clip, duration: firstDuration }
      const clip2: TimelineClip = {
        ...clip,
        id: newClipId("clip-split"),
        start: splitTime,
        duration: secondDuration,
        offset: clip.offset + relativeSplit,
        volume: 1,
      }
      setTimelineClips((prev) => prev.map((c) => (c.id === clipId ? clip1 : c)).concat(clip2))
      markPreviewStale()
    },
    [pushToHistory, timelineClips, markPreviewStale],
  )

  const handleDetachAudio = useCallback(
    (clipId: string) => {
      const clip = timelineClips.find((c) => c.id === clipId)
      if (!clip) return
      pushToHistory()
      // All ACTUAL audio tracks, not a hardcoded ["a1","a2"]: with a
      // user-created a3 track we fell back to a1 and overlapped.
      const audioTrackIds = tracks.filter((t) => t.type === "audio").map((t) => t.id)
      const targetTrackId =
        audioTrackIds.find((tid) => {
          const collisions = timelineClips.filter(
            (c) => c.trackId === tid && !(c.start >= clip.start + clip.duration || c.start + c.duration <= clip.start),
          )
          return collisions.length === 0
        }) ||
        audioTrackIds[0] ||
        "a1"
      const audioClip: TimelineClip = {
        speed: 1,
        id: newClipId("audio"),
        mediaId: clip.mediaId,
        trackId: targetTrackId,
        start: clip.start,
        duration: clip.duration,
        offset: clip.offset,
        volume: 1,
      }
      setTimelineClips((prev) => [
        ...prev.map((c) => (c.id === clipId ? { ...c, isAudioDetached: true } : c)),
        audioClip,
      ])
      markPreviewStale()
    },
    [pushToHistory, timelineClips, tracks, markPreviewStale],
  )

  const handleDeleteClip = useCallback(
    (clipIds: string[]) => {
      pushToHistory()
      setTimelineClips((prev) => prev.filter((c) => !clipIds.includes(c.id)))
      setSelectedClipIds([])
      markPreviewStale()
    },
    [pushToHistory, markPreviewStale],
  )

  const handleRippleDeleteClip = useCallback(
    (clipIds: string[]) => {
      if (clipIds.length === 0) return
      pushToHistory()
      const clipsToDelete = timelineClips.filter((c) => clipIds.includes(c.id))
      setTimelineClips((prev) => {
        // Each survivor's shift is the sum of the durations deleted BEFORE it,
        // measured on the ORIGINAL positions.
        //
        // The old version applied deletions one after another, comparing the
        // survivor's already-shifted `start` to the deleted clip's original
        // `start`: from two deletions on the same track onwards, the final
        // positions were wrong.
        return prev
          .filter((c) => !clipIds.includes(c.id))
          .map((c) => {
            const shift = clipsToDelete.reduce(
              (n, dc) => (dc.trackId === c.trackId && dc.start < c.start ? n + dc.duration : n),
              0,
            )
            return shift > 0 ? { ...c, start: Math.max(0, c.start - shift) } : c
          })
      })
      setSelectedClipIds([])
      markPreviewStale()
    },
    [pushToHistory, timelineClips, markPreviewStale],
  )

  const handleDuplicateClip = useCallback(
    (clipIds: string[]) => {
      if (clipIds.length === 0) return
      pushToHistory()
      const clipsToDuplicate = timelineClips.filter((c) => clipIds.includes(c.id))
      // Insertion point of each copy, on the ORIGINAL positions.
      const inserts = clipsToDuplicate.map((clip) => ({ clip, at: clip.start + clip.duration }))

      setTimelineClips((prev) => {
        // EXISTING clips shift by the sum of the copies inserted before them.
        const shifted = prev.map((c) => {
          const shift = inserts.reduce(
            (n, ins) => (ins.clip.trackId === c.trackId && ins.at <= c.start ? n + ins.clip.duration : n),
            0,
          )
          return shift > 0 ? { ...c, start: c.start + shift } : c
        })

        // The copies themselves are only shifted by the insertions that
        // PRECEDE them. The old version pushed them into `updated` as it went,
        // so the next iteration shifted them again like existing clips:
        // duplicating three clips at once moved two of them too far.
        const copies = inserts.map(({ clip, at }) => {
          const shift = inserts.reduce(
            (n, other) =>
              other.clip.id !== clip.id && other.clip.trackId === clip.trackId && other.at <= at
                ? n + other.clip.duration
                : n,
            0,
          )
          return {
            ...clip,
            id: newClipId("clip"),
            start: at + shift,
            transition: undefined,
            volume: clip.volume ?? 1,
          }
        })

        return [...shifted, ...copies]
      })
      markPreviewStale()
    },
    [pushToHistory, timelineClips, markPreviewStale],
  )

  const handleOverwriteClips = useCallback(
    (movedClipIds: string[]) => {
      const movedClips = timelineClips.filter((c) => movedClipIds.includes(c.id))
      if (movedClips.length === 0) return

      let clipsModified = false
      // A SINGLE live list. The old version accumulated `clipsToDelete` and
      // `clipsToAdd` alongside `updatedClips` and only applied them at the end:
      // a clip already marked for deletion by a first moved clip could be split
      // by a second one, and the fragment came back at the final add.
      let updatedClips = [...timelineClips]

      movedClips.forEach((movedClip) => {
        const movedStart = movedClip.start
        const movedEnd = movedClip.start + movedClip.duration

        const overlappingClips = updatedClips.filter(
          (c) =>
            c.trackId === movedClip.trackId &&
            c.id !== movedClip.id &&
            !movedClipIds.includes(c.id) &&
            !c.isLocked &&
            c.start < movedEnd &&
            c.start + c.duration > movedStart,
        )

        overlappingClips.forEach((overlapClip) => {
          const overlapStart = overlapClip.start
          const overlapEnd = overlapClip.start + overlapClip.duration

          // Case 1: the moved clip fully covers it — delete.
          if (movedStart <= overlapStart && movedEnd >= overlapEnd) {
            updatedClips = updatedClips.filter((c) => c.id !== overlapClip.id)
            clipsModified = true
          }
          // Case 2: the moved clip lands in the middle — split in two.
          else if (movedStart > overlapStart && movedEnd < overlapEnd) {
            const firstPartDuration = movedStart - overlapStart
            const secondPart: TimelineClip = {
              ...overlapClip,
              id: newClipId("clip-split"),
              start: movedEnd,
              duration: overlapEnd - movedEnd,
              offset: overlapClip.offset + (movedEnd - overlapStart),
            }
            updatedClips = updatedClips.map((c) =>
              c.id === overlapClip.id ? { ...c, duration: firstPartDuration } : c,
            )
            updatedClips.push(secondPart)
            clipsModified = true
          }
          // Case 3: overlaps the start — trim the start.
          else if (movedStart <= overlapStart && movedEnd > overlapStart && movedEnd < overlapEnd) {
            const trimAmount = movedEnd - overlapStart
            updatedClips = updatedClips.map((c) =>
              c.id === overlapClip.id
                ? { ...c, start: movedEnd, duration: c.duration - trimAmount, offset: c.offset + trimAmount }
                : c,
            )
            clipsModified = true
          }
          // Case 4: overlaps the end — trim the end.
          else if (movedStart > overlapStart && movedStart < overlapEnd && movedEnd >= overlapEnd) {
            updatedClips = updatedClips.map((c) =>
              c.id === overlapClip.id ? { ...c, duration: movedStart - overlapStart } : c,
            )
            clipsModified = true
          }
        })
      })

      if (clipsModified) {
        setTimelineClips(updatedClips)
        markPreviewStale()
      }
    },
    [timelineClips, markPreviewStale],
  )

  const handleAddTextClip = useCallback(
    (trackId: string, start: number) => {
      pushToHistory()
      const newClip: TimelineClip = {
        speed: 1,
        id: newClipId("text"),
        mediaId: "", // Text clips don't have media
        trackId,
        start,
        duration: 3, // Default 3 second duration
        offset: 0,
        volume: 1,
        textOverlay: {
          text: "New Text",
          fontSize: 48,
          fontFamily: "Inter, sans-serif",
          fontWeight: "bold",
          color: "#ffffff",
          backgroundColor: "#000000",
          backgroundOpacity: 50,
          textAlign: "center",
          position: { x: 50, y: 50 },
          animation: "fade-in",
        },
      }
      setTimelineClips((prev) => [...prev, newClip])
      setSelectedClipIds([newClip.id])
      markPreviewStale()
    },
    [pushToHistory, markPreviewStale],
  )

  const onToolChange = useCallback((newTool: "select" | "razor") => {
    setTool(newTool)
  }, [])

  return {
    media,
    setMedia,
    mediaMap,
    tracks,
    setTracks,
    timelineClips,
    setTimelineClips,
    selectedClipIds,
    setSelectedClipIds,
    selectionBounds,
    tool,
    setTool,
    zoomLevel,
    setZoomLevel,
    contentDuration,
    timelineDuration,
    history,
    future,
    pushToHistory,
    undo,
    redo,
    handleClipUpdate,
    handleTrackUpdate,
    handleAddTrack,
    handleReorderTracks,
    handleSelectClips,
    handleZoomChange,
    handleAddToTimeline,
    handleRemoveMedia,
    handleSplitClip,
    handleDetachAudio,
    handleDeleteClip,
    handleRippleDeleteClip,
    handleDuplicateClip,
    handleOverwriteClips,
    handleAddTextClip,
    onToolChange,
  }
}
