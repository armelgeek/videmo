"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { poserPositionLecture } from "@/lib/editor/playback-clock"
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
  // Position ou la lecture reprendra. Posee par un seek, par un deplacement
  // venu de l'exterieur, et par l'arret de la lecture — jamais deduite du
  // rendu : `currentTime` ne suit plus l'horloge pendant la lecture.
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
            // Une source qui vient de changer n'a pas encore ses metadonnees :
            // ecrire `currentTime` dessus est ignore, et `play()` est
            // interrompu par le chargement — l'erreur partait dans le `catch`
            // vide, et le clip suivant demarrait au debut du fichier au lieu de
            // son point d'entree. On laisse donc le chargement se faire et on
            // reprend a la frame suivante.
            const sourceChangee = !player.src.includes(mediaItem.url)
            if (sourceChangee) {
              player.src = mediaItem.url
            }
            if (sourceChangee || player.readyState < 1) {
              if (player.style.opacity !== opacity.toString()) {
                player.style.opacity = opacity.toString()
              }
              return
            }
            // `clip.speed` etait un champ mort : il etait ecrit partout mais ni
            // la position ni le playbackRate ne le lisaient, si bien que changer
            // la vitesse d'un clip n'avait aucun effet.
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

        // Les deux fondus durent 0,3 SECONDE, exprimees ici en fraction de clip
        // puisque `progress` en est une. `fadeInDuration` valait 0.3 tel quel et
        // etait compare a `progress` : le fade-in durait 30 % du clip pendant que
        // le fade-out durait 0,3 s — sur un clip de 10 s, 3 s contre 0,3 s.
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
              // La regex d'origine s'ecrivait /inset$$([^)]+)$$/ : `$$` est une
              // double ancre de fin, elle ne matchait JAMAIS. Les transitions
              // wipe n'etaient donc pas decoupees dans le rendu canvas (export),
              // alors qu'elles l'etaient dans l'apercu DOM.
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
    // On deplace l'horloge de lecture ET la position de reprise : l'effet de
    // demarrage ne relit plus `currentTime`, c'est donc ici que le scrub en
    // cours de lecture doit atterrir.
    currentTimeRef.current = time
    seekTargetRef.current = time
    poserPositionLecture(time)
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

  // La boucle est relancee par une ref, jamais par une dependance d'effet.
  //
  // `animate` depend de `syncMediaToTime`, donc des clips, des pistes et du
  // media : la moindre nouvelle reference en amont lui donnait une nouvelle
  // identite, l'effet de demarrage se rejouait, et sa premiere ligne
  // (`currentTimeRef = seekTargetRef`) ramenait la tete de lecture a la
  // position de reprise. La lecture repartait du debut toutes les deux
  // secondes. `battre` est stable : la frame suivante appelle toujours la
  // derniere version d'`animate` sans que rien n'ait a se redemarrer.
  const animateRef = useRef<(time: number) => void>(() => {})
  const battre = useCallback((time: number) => {
    animateRef.current(time)
  }, [])

  const animate = useCallback(
    (time: number) => {
      if (isExporting || isRendering) return
      if (lastTimeRef.current !== null) {
        // Le pas d'une frame est BORNE.
        //
        // Sans borne, il vaut tout le temps ecoule depuis la frame precedente —
        // y compris un gel du thread principal. Au passage au clip suivant,
        // `syncMediaToTime` reassigne `src` et rappelle `play()` : le
        // chargement gele la boucle, et la frame d'apres arrivait avec un pas
        // de plusieurs secondes. Un seul de ces pas suffisait a franchir
        // `timelineDuration`, et la tete de lecture bondissait a la fin.
        //
        // Un quart de seconde est bien au-dela d'une frame normale (16 ms a
        // 60 Hz) tout en gardant la lecture proche du temps reel : un gel plus
        // long prend du retard, il ne saute plus.
        const PAS_MAX_SECONDES = 0.25
        const deltaTime = Math.min((time - lastTimeRef.current) / 1000, PAS_MAX_SECONDES)
        const nextTime = currentTimeRef.current + deltaTime

        if (nextTime >= timelineDuration) {
          if (isLooping) {
            currentTimeRef.current = 0
            poserPositionLecture(0)
            setCurrentTime(0)
          } else {
            setIsPlaying(false)
            currentTimeRef.current = 0
            poserPositionLecture(0)
            setCurrentTime(0)
            lastTimeRef.current = time
            return
          }
        } else {
          currentTimeRef.current = nextTime
        }

        // L'horloge externe est posee a CHAQUE frame : elle ne rend que ses
        // abonnes — le curseur, la reglette — pas l'editeur entier.
        poserPositionLecture(currentTimeRef.current)

        syncMediaToTime(currentTimeRef.current, false)

        // Plus d'ecriture dans l'etat React pendant la lecture. Meme ramenee a
        // 30 Hz, elle rendait l'editeur entier — timeline, apercu, dialogues —
        // trente fois par seconde pour deplacer un curseur. Ce qui suit
        // l'horloge y est abonne (cf. playback-clock) ; `currentTime` ne porte
        // plus que les deplacements DISCRETS : un seek, un arret, un retour au
        // debut.
      }
      lastTimeRef.current = time
      if (isPlaying) {
        requestRef.current = requestAnimationFrame(battre)
      }
    },
    [isPlaying, timelineDuration, isExporting, isRendering, isLooping, syncMediaToTime, battre],
  )

  useEffect(() => {
    if (!isExporting && !isRendering && !isPlaying) {
      syncMediaToTime(currentTime, false)
    }
  }, [currentTime, syncMediaToTime, isExporting, isRendering, isPlaying])

  animateRef.current = animate

  useEffect(() => {
    // Ni `currentTime` ni `animate` ne sont des dependances.
    //
    // La boucle ecrit currentTime 30 fois par seconde ; l'effet se reexecutait
    // donc 30 fois par seconde, annulant et recreant le requestAnimationFrame a
    // chaque passage et reecrivant currentTimeRef avec la valeur throttlee,
    // c'est-a-dire en retard d'une frame sur l'horloge reelle.
    if (isPlaying && !isExporting && !isRendering) {
      currentTimeRef.current = seekTargetRef.current
      poserPositionLecture(currentTimeRef.current)
      lastTimeRef.current = null
      requestRef.current = requestAnimationFrame(battre)
    } else {
      lastTimeRef.current = null
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      // L'arret est un instant DISCRET : c'est la que l'etat React reprend la
      // main sur l'horloge. Sans cela il porterait encore la position du
      // dernier seek, et reprendre la lecture repartirait de la.
      seekTargetRef.current = currentTimeRef.current
      setCurrentTime((prev) =>
        prev === currentTimeRef.current ? prev : currentTimeRef.current,
      )
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [isPlaying, battre, isExporting, isRendering])

  // Deplacer la tete de lecture depuis l'exterieur doit bouger les TROIS
  // representations : l'horloge de la boucle, l'horloge externe a laquelle le
  // curseur est abonne, et l'etat React que lisent encore quelques ecrans.
  const placerPositionLecture = useCallback((time: number) => {
    currentTimeRef.current = time
    seekTargetRef.current = time
    poserPositionLecture(time)
    setCurrentTime(time)
  }, [])

  return {
    currentTime,
    setCurrentTime: placerPositionLecture,
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
