"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { setPlaybackPosition } from "@/lib/editor/playback-clock"
import type { TimelineClip, Track, MediaItem, ClipEffects, TextOverlayStyle } from "../types"

export interface UsePlaybackOptions {
  timelineClips: TimelineClip[]
  tracks: Track[]
  mediaMap: Record<string, MediaItem>
  timelineDuration: number
  isExporting: boolean
  isRendering: boolean
  isLooping?: boolean
}

export interface UsePlaybackResult {
  currentTime: number
  setCurrentTime: (time: number) => void
  isPlaying: boolean
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>
  isPreviewPlayback: boolean
  setIsPreviewPlayback: (preview: boolean) => void

  // Video refs
  videoRefA: React.RefObject<HTMLVideoElement | null>
  videoRefB: React.RefObject<HTMLVideoElement | null>
  whiteOverlayRef: React.RefObject<HTMLDivElement | null>
  previewVideoRef: React.RefObject<HTMLVideoElement | null>
  audioRefs: React.MutableRefObject<Record<string, HTMLAudioElement>>
  canvasRef: React.RefObject<HTMLCanvasElement | null>

  // Audio context
  audioContextRef: React.MutableRefObject<AudioContext | null>
  audioDestRef: React.MutableRefObject<MediaStreamAudioDestinationNode | null>
  sourceNodesRef: React.MutableRefObject<Map<string, MediaElementAudioSourceNode>>

  // Methods
  syncMediaToTime: (time: number, isExportingNow?: boolean) => void
  drawFrameToCanvas: (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => void
  waitForVideoReady: (video: HTMLVideoElement) => Promise<void>
  setupAudioGraph: () => void
  handleSeek: (time: number) => void
  handleDragStart: () => void
  handleTogglePreviewPlayback: () => void
}

export function usePlayback({
  timelineClips,
  tracks,
  mediaMap,
  timelineDuration,
  isExporting,
  isRendering,
  isLooping = false,
}: UsePlaybackOptions): UsePlaybackResult {
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPreviewPlayback, setIsPreviewPlayback] = useState(false)

  const currentTimeRef = useRef(0)
  // Position playback will resume from. Set by a seek, by a move coming from
  // outside, and by stopping playback — never derived from rendering:
  // `currentTime` no longer follows the clock during playback.
  const seekTargetRef = useRef(0)

  // Refs for video/audio elements
  const videoRefA = useRef<HTMLVideoElement | null>(null)
  const videoRefB = useRef<HTMLVideoElement | null>(null)
  const whiteOverlayRef = useRef<HTMLDivElement | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Audio context refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const sourceNodesRef = useRef<Map<string, MediaElementAudioSourceNode>>(new Map())

  // Animation refs
  const requestRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  const setupAudioGraph = useCallback(() => {
    if (typeof window === "undefined") return

    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx()
        if (typeof audioContextRef.current.createMediaStreamDestination === "function") {
          audioDestRef.current = audioContextRef.current.createMediaStreamDestination()
        }
      }
    }
    const ctx = audioContextRef.current
    const dest = audioDestRef.current
    if (!ctx) return
    ;[videoRefA, videoRefB].forEach((ref, idx) => {
      const id = `video-${idx}`
      if (ref.current && !sourceNodesRef.current.has(id)) {
        try {
          const source = ctx.createMediaElementSource(ref.current)
          if (dest) source.connect(dest)
          source.connect(ctx.destination)
          sourceNodesRef.current.set(id, source)
        } catch (e) {}
      }
    })
    Object.entries(audioRefs.current).forEach(([trackId, el]) => {
      if (el && !sourceNodesRef.current.has(trackId)) {
        try {
          const source = ctx.createMediaElementSource(el)
          if (dest) source.connect(dest)
          source.connect(ctx.destination)
          sourceNodesRef.current.set(trackId, source)
        } catch (e) {}
      }
    })
  }, [])

  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) setupAudioGraph()
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume()
      }
    }
    window.addEventListener("click", initAudio, { once: true })
    window.addEventListener("keydown", initAudio, { once: true })
    return () => {
      window.removeEventListener("click", initAudio)
      window.removeEventListener("keydown", initAudio)
    }
  }, [setupAudioGraph])

  const syncMediaToTime = useCallback(
    (time: number, isExportingNow = false) => {
      const playerA = videoRefA.current
      const playerB = videoRefB.current
      const whiteOverlay = whiteOverlayRef.current
      if (!playerA || !playerB) return

      playerB.style.clipPath = "none"
      playerA.style.clipPath = "none"
      if (whiteOverlay) whiteOverlay.style.opacity = "0"

      const activeClip = tracks
        .filter((t) => t.type === "video")
        .reverse()
        .map((t) => timelineClips.find((c) => c.trackId === t.id && time >= c.start && time < c.start + c.duration))
        .find((c) => c !== undefined)

      const activeTrack = tracks.find((t) => t.id === activeClip?.trackId)
      const trackVolume = activeTrack?.volume ?? 1
      const clipVolume = activeClip?.volume ?? 1
      const isMuted = activeTrack?.isMuted || activeClip?.isAudioDetached
      const effectiveVolume = isMuted ? 0 : trackVolume * clipVolume

      const setPlayerState = (player: HTMLVideoElement | null, clip: TimelineClip | undefined, opacity: number) => {
        if (player && clip) {
          const mediaItem = mediaMap[clip.mediaId]
          if (mediaItem) {
            // A source that just changed has no metadata yet: writing
            // `currentTime` on it is ignored, and `play()` is interrupted by
            // loading — the error went into the empty `catch`, and the next
            // clip started at the beginning of the file instead of its in
            // point. So we let loading happen and resume on the next frame.
            const sourceChanged = !player.src.includes(mediaItem.url)
            if (sourceChanged) {
              player.src = mediaItem.url
            }
            if (sourceChanged || player.readyState < 1) {
              if (player.style.opacity !== opacity.toString()) {
                player.style.opacity = opacity.toString()
              }
              return
            }
            // `clip.speed` was a dead field: written everywhere but read by
            // neither the position nor the playbackRate, so changing a clip's
            // speed had no effect.
            const speed = clip.speed && clip.speed > 0 ? clip.speed : 1
            const timeInClip = (time - clip.start) * speed + clip.offset
            if (isExportingNow || Math.abs(player.currentTime - timeInClip) > 0.1) {
              player.currentTime = timeInClip
            }
            if (player.playbackRate !== speed) player.playbackRate = speed
            if (isExportingNow) {
              player.pause()
            } else if (isPlaying) {
              player.play().catch(() => {})
            } else {
              player.pause()
            }
            player.muted = effectiveVolume === 0
            player.volume = effectiveVolume
          }
        } else if (player) {
          player.pause()
        }
        if (player) player.style.opacity = opacity.toString()
      }

      if (activeClip && activeClip.transition && activeClip.transition.type !== "none") {
        const transDuration = activeClip.transition.duration
        const progress = (time - activeClip.start) / transDuration

        if (progress < 1.0 && progress >= 0) {
          const sameTrackClips = timelineClips
            .filter((c) => c.trackId === activeClip.trackId)
            .sort((a, b) => a.start - b.start)
          const idx = sameTrackClips.findIndex((c) => c.id === activeClip.id)
          const prevClip = sameTrackClips[idx - 1]

          if (prevClip) {
            const type = activeClip.transition.type
            if (type === "cross-dissolve") {
              setPlayerState(videoRefA.current, prevClip, 1 - progress)
              setPlayerState(videoRefB.current, activeClip, progress)
            } else if (type === "fade-black") {
              setPlayerState(videoRefA.current, prevClip, 1)
              setPlayerState(videoRefB.current, activeClip, 1)
              if (progress < 0.5) {
                if (videoRefA.current) videoRefA.current.style.opacity = (1 - progress * 2).toString()
                if (videoRefB.current) videoRefB.current.style.opacity = "0"
              } else {
                if (videoRefA.current) videoRefA.current.style.opacity = "0"
                if (videoRefB.current) videoRefB.current.style.opacity = ((progress - 0.5) * 2).toString()
              }
            } else if (type === "fade-white") {
              const whiteOpacity = 1 - Math.abs((progress - 0.5) * 2)
              if (whiteOverlay) whiteOverlay.style.opacity = whiteOpacity.toString()
              if (progress < 0.5) {
                setPlayerState(videoRefA.current, prevClip, 1)
                setPlayerState(videoRefB.current, activeClip, 0)
                if (videoRefB.current) videoRefB.current.style.opacity = "0"
              } else {
                setPlayerState(videoRefA.current, prevClip, 0)
                setPlayerState(videoRefB.current, activeClip, 1)
                if (videoRefA.current) videoRefA.current.style.opacity = "0"
              }
            } else if (type === "wipe-left") {
              setPlayerState(videoRefA.current, prevClip, 1)
              setPlayerState(videoRefB.current, activeClip, 1)
              const percent = (1 - progress) * 100
              if (videoRefB.current) videoRefB.current.style.clipPath = `inset(0 ${percent}% 0 0)`
            } else if (type === "wipe-right") {
              setPlayerState(videoRefA.current, prevClip, 1)
              setPlayerState(videoRefB.current, activeClip, 1)
              const percent = (1 - progress) * 100
              if (videoRefB.current) videoRefB.current.style.clipPath = `inset(0 0 0 ${percent}%)`
            }
          } else {
            setPlayerState(videoRefB.current, activeClip, progress)
            if (videoRefA.current) videoRefA.current.style.opacity = "0"
          }
        } else {
          setPlayerState(videoRefA.current, activeClip, activeClip ? 1 : 0)
          if (videoRefB.current) videoRefB.current.style.opacity = "0"
        }
      } else {
        setPlayerState(videoRefA.current, activeClip, activeClip ? 1 : 0)
        if (videoRefB.current) videoRefB.current.style.opacity = "0"
      }

      tracks
        .filter((t) => t.type === "audio")
        .forEach((track) => {
          const audioEl = audioRefs.current[track.id]
          if (!audioEl) return
          const activeAudioClip = timelineClips.find(
            (c) => c.trackId === track.id && time >= c.start && time < c.start + c.duration,
          )
          if (activeAudioClip) {
            const mediaItem = mediaMap[activeAudioClip.mediaId]
            if (mediaItem) {
              if (!audioEl.src.includes(mediaItem.url)) {
                audioEl.src = mediaItem.url
              }
              const speed =
                activeAudioClip.speed && activeAudioClip.speed > 0 ? activeAudioClip.speed : 1
              const timeInClip = (time - activeAudioClip.start) * speed + activeAudioClip.offset
              if (isExportingNow || Math.abs(audioEl.currentTime - timeInClip) > 0.1) {
                audioEl.currentTime = timeInClip
              }
              if (audioEl.playbackRate !== speed) audioEl.playbackRate = speed
              if (isPlaying && !isExportingNow) {
                audioEl.play().catch(() => {})
              } else {
                audioEl.pause()
              }
              const clipVol = activeAudioClip.volume ?? 1
              audioEl.volume = track.isMuted ? 0 : (track.volume ?? 1) * clipVol
            }
          } else {
            audioEl.pause()
          }
        })
    },
    [timelineClips, mediaMap, tracks, isPlaying],
  )

  const drawFrameToCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, width, height)

      const buildFilterString = (effects: ClipEffects | undefined): string => {
        if (!effects) return "none"
        const filters: string[] = []
        if (effects.brightness !== 0) {
          filters.push(`brightness(${1 + effects.brightness / 100})`)
        }
        if (effects.contrast !== 0) {
          filters.push(`contrast(${1 + effects.contrast / 100})`)
        }
        if (effects.saturation !== 0) {
          filters.push(`saturate(${1 + effects.saturation / 100})`)
        }
        if (effects.hue !== 0) {
          filters.push(`hue-rotate(${effects.hue}deg)`)
        }
        if (effects.blur > 0) {
          filters.push(`blur(${effects.blur}px)`)
        }
        return filters.length > 0 ? filters.join(" ") : "none"
      }

      const drawTextOverlay = (overlay: TextOverlayStyle, clipStart: number, clipDuration: number) => {
        const progress = (time - clipStart) / clipDuration
        let opacity = 1
        let offsetY = 0
        let displayText = overlay.text

        // Both fades last 0.3 SECONDS, expressed here as a fraction of the clip
        // since `progress` is one. `fadeInDuration` was 0.3 as is and compared
        // to `progress`: the fade-in lasted 30% of the clip while the fade-out
        // lasted 0.3 s — on a 10 s clip, 3 s versus 0.3 s.
        const FADE_SECONDS = 0.3
        const fadeInDuration = clipDuration > 0 ? FADE_SECONDS / clipDuration : 1
        const fadeOutStart = 1 - fadeInDuration

        switch (overlay.animation) {
          case "fade-in":
            opacity = Math.min(1, progress / fadeInDuration)
            break
          case "fade-out":
            opacity = progress > fadeOutStart ? 1 - (progress - fadeOutStart) / (1 - fadeOutStart) : 1
            break
          case "slide-up":
            const slideProgress = Math.min(1, progress / fadeInDuration)
            opacity = slideProgress
            offsetY = (1 - slideProgress) * 20
            break
          case "slide-down":
            const slideDownProgress = Math.min(1, progress / fadeInDuration)
            opacity = slideDownProgress
            offsetY = (slideDownProgress - 1) * 20
            break
          case "typewriter":
            const charsToShow = Math.floor(progress * overlay.text.length * 1.2)
            displayText = overlay.text.slice(0, Math.min(charsToShow, overlay.text.length))
            break
        }

        const posX = (overlay.position.x / 100) * width
        const posY = (overlay.position.y / 100) * height + offsetY

        ctx.save()
        ctx.globalAlpha = opacity * ((overlay as any).opacity ?? 1)

        if (overlay.backgroundOpacity > 0) {
          ctx.font = `${overlay.fontWeight} ${overlay.fontSize}px ${overlay.fontFamily}`
          ctx.textAlign = overlay.textAlign as CanvasTextAlign
          ctx.textBaseline = "middle"

          const metrics = ctx.measureText(displayText)
          const textWidth = metrics.width
          const textHeight = overlay.fontSize * 1.2
          const padding = overlay.fontSize * 0.25

          let bgX = posX - padding
          if (overlay.textAlign === "center") bgX -= textWidth / 2
          else if (overlay.textAlign === "right") bgX -= textWidth

          ctx.globalAlpha = opacity * (overlay.backgroundOpacity / 100)
          ctx.fillStyle = overlay.backgroundColor
          ctx.fillRect(bgX, posY - textHeight / 2 - padding, textWidth + padding * 2, textHeight + padding * 2)
        }

        ctx.globalAlpha = opacity
        ctx.font = `${overlay.fontWeight} ${overlay.fontSize}px ${overlay.fontFamily}`
        ctx.fillStyle = overlay.color
        ctx.textAlign = overlay.textAlign as CanvasTextAlign
        ctx.textBaseline = "middle"
        ctx.fillText(displayText, posX, posY)

        ctx.restore()
      }

      const activeClip = tracks
        .filter((t) => t.type === "video")
        .reverse()
        .map((t) => timelineClips.find((c) => c.trackId === t.id && time >= c.start && time < c.start + c.duration))
        .find((c) => c !== undefined)

      const drawScaled = (video: HTMLVideoElement | null, effects?: ClipEffects) => {
        if (!video) return
        const vW = video.videoWidth
        const vH = video.videoHeight
        if (!vW || !vH) return
        const scale = Math.min(width / vW, height / vH)
        const dw = vW * scale
        const dh = vH * scale
        const dx = (width - dw) / 2
        const dy = (height - dh) / 2

        ctx.save()
        const filterStr = buildFilterString(effects)
        if (filterStr !== "none") {
          ctx.filter = filterStr
        }
        if (effects?.opacity !== undefined && effects.opacity < 100) {
          ctx.globalAlpha = ctx.globalAlpha * (effects.opacity / 100)
        }
        ctx.drawImage(video, dx, dy, dw, dh)
        ctx.restore()
      }

      const opacityA = Number.parseFloat(videoRefA.current?.style.opacity || "0")
      const opacityB = Number.parseFloat(videoRefB.current?.style.opacity || "0")
      const clipPathB = videoRefB.current?.style.clipPath || "none"

      if (opacityA > 0 && videoRefA.current) {
        ctx.globalAlpha = opacityA
        drawScaled(videoRefA.current, activeClip?.effects)
      }

      if (opacityB > 0 && videoRefB.current) {
        ctx.globalAlpha = opacityB
        if (clipPathB !== "none" && clipPathB.startsWith("inset")) {
          ctx.save()
          ctx.beginPath()
          const vals =
            clipPathB
              // The original regex was /inset$$([^)]+)$$/: `$$` is a double
              // end anchor, it NEVER matched. So wipe transitions were not
              // clipped in the canvas render (export), while they were in the
              // DOM preview.
              .match(/inset\(([^)]+)\)/)?.[1]
              .split(" ")
              .map((s) => Number.parseFloat(s)) || []
          const rightPct = vals.length === 4 ? vals[1] : 0
          const leftPct = vals.length === 4 ? vals[3] : 0
          const x = (leftPct / 100) * width
          const w = width - x - (rightPct / 100) * width
          ctx.rect(x, 0, w, height)
          ctx.clip()
          drawScaled(videoRefB.current, activeClip?.effects)
          ctx.restore()
        } else {
          drawScaled(videoRefB.current, activeClip?.effects)
        }
      }

      const transitionClip = timelineClips.find(
        (c) =>
          c.trackId.startsWith("v") &&
          time >= c.start &&
          time < c.start + c.duration &&
          c.transition?.type === "fade-white",
      )
      if (transitionClip) {
        const transDuration = transitionClip.transition!.duration
        const progress = (time - transitionClip.start) / transDuration
        if (progress >= 0 && progress <= 1) {
          const whiteOpacity = 1 - Math.abs((progress - 0.5) * 2)
          if (whiteOpacity > 0) {
            ctx.globalAlpha = whiteOpacity
            ctx.fillStyle = "#FFFFFF"
            ctx.fillRect(0, 0, width, height)
          }
        }
      }
      ctx.globalAlpha = 1

      const activeTextClips = timelineClips.filter((clip) => {
        if (!clip.textOverlay) return false
        const clipEnd = clip.start + clip.duration
        return time >= clip.start && time < clipEnd
      })

      for (const textClip of activeTextClips) {
        drawTextOverlay(textClip.textOverlay!, textClip.start, textClip.duration)
      }
    },
    [timelineClips, tracks],
  )

  const waitForVideoReady = useCallback(async (video: HTMLVideoElement) => {
    if (!video || !video.src || video.style.opacity === "0") return
    if (video.readyState < 1) {
      await new Promise((resolve) => {
        const h = () => {
          video.removeEventListener("loadedmetadata", h)
          resolve(null)
        }
        video.addEventListener("loadedmetadata", h, { once: true })
        setTimeout(() => {
          video.removeEventListener("loadedmetadata", h)
          resolve(null)
        }, 2000)
      })
    }
    if (video.seeking) {
      await new Promise((resolve) => {
        const h = () => {
          video.removeEventListener("seeked", h)
          resolve(null)
        }
        video.addEventListener("seeked", h, { once: true })
        setTimeout(() => {
          video.removeEventListener("seeked", h)
          resolve(null)
        }, 2000)
      })
    }
    if (video.readyState < 2) {
      await new Promise((resolve) => {
        const h = () => {
          video.removeEventListener("canplay", h)
          resolve(null)
        }
        video.addEventListener("canplay", h, { once: true })
        setTimeout(() => {
          video.removeEventListener("canplay", h)
          resolve(null)
        }, 2000)
      })
    }
  }, [])

  const handleSeek = useCallback((time: number) => {
    // Move both the playback clock AND the resume position: the start effect
    // no longer reads `currentTime`, so this is where a scrub during playback
    // must land.
    currentTimeRef.current = time
    seekTargetRef.current = time
    setPlaybackPosition(time)
    setCurrentTime((prev) => (prev === time ? prev : time))
  }, [])

  const handleDragStart = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false)
    }
  }, [isPlaying])

  const handleTogglePreviewPlayback = useCallback(() => {
    if (isPreviewPlayback) {
      if (previewVideoRef.current) {
        previewVideoRef.current.pause()
      }
      setIsPreviewPlayback(false)
    } else {
      setIsPlaying(false)
      setIsPreviewPlayback(true)
      setTimeout(() => {
        if (previewVideoRef.current) {
          previewVideoRef.current.currentTime = 0
          previewVideoRef.current.play()
        }
      }, 100)
    }
  }, [isPreviewPlayback])

  // The loop is re-armed through a ref, never through an effect dependency.
  //
  // `animate` depends on `syncMediaToTime`, hence on clips, tracks and media:
  // any new upstream reference gave it a new identity, the start effect
  // re-ran, and its first line (`currentTimeRef = seekTargetRef`) sent the
  // playhead back to the resume position. Playback restarted from the
  // beginning every couple of seconds. `tick` is stable: the next frame always
  // calls the latest `animate` without anything having to restart.
  const animateRef = useRef<(time: number) => void>(() => {})
  const tick = useCallback((time: number) => {
    animateRef.current(time)
  }, [])

  const animate = useCallback(
    (time: number) => {
      if (isExporting || isRendering) return
      if (lastTimeRef.current !== null) {
        // A frame's step is BOUNDED.
        //
        // Unbounded, it equals all the time elapsed since the previous frame —
        // including a main-thread freeze. When moving to the next clip,
        // `syncMediaToTime` reassigns `src` and calls `play()` again: loading
        // freezes the loop, and the following frame arrived with a step of
        // several seconds. A single such step was enough to cross
        // `timelineDuration`, and the playhead jumped to the end.
        //
        // A quarter second is well beyond a normal frame (16 ms at 60 Hz)
        // while keeping playback close to real time: a longer freeze falls
        // behind, it no longer jumps.
        const MAX_STEP_SECONDS = 0.25
        const deltaTime = Math.min((time - lastTimeRef.current) / 1000, MAX_STEP_SECONDS)
        const nextTime = currentTimeRef.current + deltaTime

        if (nextTime >= timelineDuration) {
          if (isLooping) {
            currentTimeRef.current = 0
            setPlaybackPosition(0)
            setCurrentTime(0)
          } else {
            setIsPlaying(false)
            currentTimeRef.current = 0
            setPlaybackPosition(0)
            setCurrentTime(0)
            lastTimeRef.current = time
            return
          }
        } else {
          currentTimeRef.current = nextTime
        }

        // The external clock is set on EVERY frame: it only re-renders its
        // subscribers — the cursor, the ruler — not the whole editor.
        setPlaybackPosition(currentTimeRef.current)

        syncMediaToTime(currentTimeRef.current, false)

        // No more writes to React state during playback. Even throttled to
        // 30 Hz, it re-rendered the whole editor — timeline, preview, dialogs —
        // thirty times per second to move a cursor. Whatever follows the clock
        // subscribes to it (see playback-clock); `currentTime` only carries
        // DISCRETE moves: a seek, a stop, a return to the start.
      }
      lastTimeRef.current = time
      if (isPlaying) {
        requestRef.current = requestAnimationFrame(tick)
      }
    },
    [isPlaying, timelineDuration, isExporting, isRendering, isLooping, syncMediaToTime, tick],
  )

  useEffect(() => {
    if (!isExporting && !isRendering && !isPlaying) {
      syncMediaToTime(currentTime, false)
    }
  }, [currentTime, syncMediaToTime, isExporting, isRendering, isPlaying])

  animateRef.current = animate

  useEffect(() => {
    // Neither `currentTime` nor `animate` are dependencies.
    //
    // The loop wrote currentTime 30 times per second; the effect therefore
    // re-ran 30 times per second, cancelling and recreating the
    // requestAnimationFrame each time and overwriting currentTimeRef with the
    // throttled value, i.e. one frame behind the real clock.
    if (isPlaying && !isExporting && !isRendering) {
      currentTimeRef.current = seekTargetRef.current
      setPlaybackPosition(currentTimeRef.current)
      lastTimeRef.current = null
      requestRef.current = requestAnimationFrame(tick)
    } else {
      lastTimeRef.current = null
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      // Stopping is a DISCRETE instant: this is where React state takes back
      // control from the clock. Otherwise it would still hold the last seek's
      // position, and resuming playback would restart from there.
      seekTargetRef.current = currentTimeRef.current
      setCurrentTime((prev) =>
        prev === currentTimeRef.current ? prev : currentTimeRef.current,
      )
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [isPlaying, tick, isExporting, isRendering])

  // Moving the playhead from outside must update all THREE representations:
  // the loop's clock, the external clock the cursor subscribes to, and the
  // React state a few screens still read.
  // Named apart from the imported `setPlaybackPosition`: sharing the name made
  // this shadow the import, so it called itself instead of the clock — and the
  // five other call sites above stopped reaching the clock at all.
  const movePlayhead = useCallback((time: number) => {
    currentTimeRef.current = time
    seekTargetRef.current = time
    setPlaybackPosition(time)
    setCurrentTime(time)
  }, [])

  return {
    currentTime,
    setCurrentTime: movePlayhead,
    isPlaying,
    setIsPlaying,
    isPreviewPlayback,
    setIsPreviewPlayback,
    videoRefA,
    videoRefB,
    whiteOverlayRef,
    previewVideoRef,
    audioRefs,
    canvasRef,
    audioContextRef,
    audioDestRef,
    sourceNodesRef,
    syncMediaToTime,
    drawFrameToCanvas,
    waitForVideoReady,
    setupAudioGraph,
    handleDragStart,
    handleSeek,
    handleTogglePreviewPlayback,
  }
}
