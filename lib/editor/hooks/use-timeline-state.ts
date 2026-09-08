"use client"

import type React from "react"

import { useState, useCallback, useMemo } from "react"
import type { TimelineClip, Track, MediaItem, StoryboardPanel } from "../types"

const INITIAL_TRACKS: Track[] = [
  { id: "v1", name: "Video 1", type: "video", volume: 1 },
  { id: "a1", name: "Audio 1", type: "audio", volume: 1 },
]

/**
 * Un pas d'annulation.
 *
 * L'historique ne portait que `timelineClips`. Un Ctrl+Z apres la suppression
 * d'un media ressuscitait donc des clips dont le `mediaId` n'existait plus dans
 * `mediaMap` : muets, invisibles, et sans la moindre erreur. Les pistes avaient
 * le meme trou.
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
 * Identifiants de clip.
 *
 * `clip-${Date.now()}` collisionnait des que deux clips naissaient dans la meme
 * milliseconde (drop multiple, split au clavier en rafale) : cles React
 * dupliquees, et handleClipUpdate modifiait les deux clips a la fois.
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
   * `pushToHistory` est branche sur le mousedown d'un clip (`onDragStart`), donc
   * un simple clic de selection empilait un snapshot identique : il fallait
   * ensuite autant de Ctrl+Z que de clics pour defaire une seule modification.
   * On ignore un etat rigoureusement identique au sommet de la pile.
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
      // Pas de URL.revokeObjectURL ici : le media fait desormais partie du
      // snapshot d'annulation, et revoquer l'URL rendrait le Ctrl+Z inoperant
      // (clips restaures pointant sur un blob mort). Les blobs sont liberes au
      // dechargement de la page.
      // La selection se purge des clips SUPPRIMES. Le test portait sur
      // `timelineClips`, la liste d'AVANT le filtre : il etait vrai des qu'une
      // selection existait, donc jamais purge. Les ids fantomes restants
      // faisaient ensuite planter le drag (initialStates[id] undefined).
      if (selectedClipIds.length > 0) {
        const survivants = selectedClipIds.filter((id) => remaining.some((c) => c.id === id))
        if (survivants.length !== selectedClipIds.length) setSelectedClipIds(survivants)
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
      // Le garde passe AVANT pushToHistory : un split refuse empilait quand meme
      // un snapshot, et le Ctrl+Z suivant ne faisait rien de visible.
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
      // Toutes les pistes audio REELLES, pas ["a1","a2"] en dur : avec une piste
      // a3 creee par l'utilisateur on retombait sur a1 et on superposait.
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
        // Le decalage de chaque survivant est la somme des durees supprimees
        // AVANT lui, mesuree sur les positions d'ORIGINE.
        //
        // L'ancienne version appliquait les suppressions l'une apres l'autre en
        // comparant le `start` deja decale du survivant au `start` d'origine du
        // clip supprime : des deux suppressions sur une meme piste, les
        // positions finales etaient fausses.
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
      // Point d'insertion de chaque copie, sur les positions d'ORIGINE.
      const inserts = clipsToDuplicate.map((clip) => ({ clip, at: clip.start + clip.duration }))

      setTimelineClips((prev) => {
        // Les clips EXISTANTS reculent de la somme des copies inserees avant eux.
        const decale = prev.map((c) => {
          const shift = inserts.reduce(
            (n, ins) => (ins.clip.trackId === c.trackId && ins.at <= c.start ? n + ins.clip.duration : n),
            0,
          )
          return shift > 0 ? { ...c, start: c.start + shift } : c
        })

        // Les copies elles-memes ne sont decalees que par les insertions qui les
        // PRECEDENT. L'ancienne version les poussait dans `updated` au fur et a
        // mesure, si bien que l'iteration suivante les redecalait comme des
        // clips existants : dupliquer trois clips d'un coup en deplacait deux de
        // trop.
        const copies = inserts.map(({ clip, at }) => {
          const shift = inserts.reduce(
            (n, autre) =>
              autre.clip.id !== clip.id && autre.clip.trackId === clip.trackId && autre.at <= at
                ? n + autre.clip.duration
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

        return [...decale, ...copies]
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
      // Une SEULE liste vivante. L'ancienne version accumulait `clipsToDelete` et
      // `clipsToAdd` a cote de `updatedClips` et ne les appliquait qu'a la fin :
      // un clip deja marque pour suppression par un premier clip deplace pouvait
      // etre splitte par un second, et le fragment ressuscitait a l'ajout final.
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

          // Cas 1 : le clip deplace recouvre entierement — on supprime.
          if (movedStart <= overlapStart && movedEnd >= overlapEnd) {
            updatedClips = updatedClips.filter((c) => c.id !== overlapClip.id)
            clipsModified = true
          }
          // Cas 2 : le clip deplace tombe au milieu — on coupe en deux.
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
          // Cas 3 : recouvrement du debut — on rogne le debut.
          else if (movedStart <= overlapStart && movedEnd > overlapStart && movedEnd < overlapEnd) {
            const trimAmount = movedEnd - overlapStart
            updatedClips = updatedClips.map((c) =>
              c.id === overlapClip.id
                ? { ...c, start: movedEnd, duration: c.duration - trimAmount, offset: c.offset + trimAmount }
                : c,
            )
            clipsModified = true
          }
          // Cas 4 : recouvrement de la fin — on rogne la fin.
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
