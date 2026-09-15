"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
import { getZoomConfig } from "../utils/timeline-scale"

interface TimelineRulerProps {
  duration: number
  zoomLevel: number
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  onClick?: (time: number) => void
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({ duration, zoomLevel, scrollContainerRef, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const c = Math.floor((seconds % 1) * 100)
    return `${m}:${s.toString().padStart(2, "0")}.${c.toString().padStart(2, "0")}`
  }

  const draw = (ctx: CanvasRenderingContext2D, scrollLeft: number, canvasWidth: number) => {
    const height = 32 // Match h-8

    // Clear
    ctx.clearRect(0, 0, canvasWidth, height)

    // Canvas can't read CSS vars directly: resolve them so the ruler follows light/dark.
    const styles = getComputedStyle(ctx.canvas)
    ctx.fillStyle = styles.getPropertyValue("--text-tertiary").trim() || "#71717a"
    ctx.strokeStyle = styles.getPropertyValue("--text-muted").trim() || "#71717a"
    ctx.lineWidth = 1
    ctx.font = `500 10px "Inter", sans-serif` // Match app font
    ctx.textBaseline = "top"

    // Get strict tick configuration based on zoom level
    const { majorInterval, minorDivisions } = getZoomConfig(zoomLevel)

    // Calculate visible range (add buffer)
    const startSec = Math.max(0, (scrollLeft - 50) / zoomLevel)
    const endSec = (scrollLeft + canvasWidth + 50) / zoomLevel

    // Snap start to grid
    const startGrid = Math.floor(startSec / majorInterval) * majorInterval

    ctx.beginPath()

    for (let sec = startGrid; sec <= endSec; sec += majorInterval) {
      const x = Math.round(sec * zoomLevel - scrollLeft) + 0.5

      // Draw Major Tick
      ctx.moveTo(x, 12) // Start a bit lower
      ctx.lineTo(x, height)

      // Draw Text
      if (x > -20) {
        // Simple culling
        let timeStr = ""
        // Format text based on resolution
        if (majorInterval < 1) {
          // Sub-second precision
          timeStr = formatTime(sec)
        } else if (majorInterval >= 60) {
          // Minutes only
          const m = Math.floor(sec / 60)
          const s = Math.floor(sec % 60)
          timeStr = `${m}:${s.toString().padStart(2, "0")}`
        } else {
          // Standard seconds
          const m = Math.floor(sec / 60)
          const s = Math.floor(sec % 60)
          timeStr = `${m}:${s.toString().padStart(2, "0")}`
        }
        // Extra offset at 0 so the playhead doesn't cover the first label.
        ctx.fillText(timeStr, x + (sec === 0 ? 8 : 4), 2)
      }

      // Draw Minor Ticks
      const minorInterval = majorInterval / minorDivisions
      for (let i = 1; i < minorDivisions; i++) {
        const minorSec = sec + i * minorInterval
        const minorX = Math.round(minorSec * zoomLevel - scrollLeft) + 0.5

        // Skip if out of view
        if (minorX > canvasWidth) break

        // Dynamic height for minor ticks
        const isMid = i === minorDivisions / 2
        const tickY = isMid ? 20 : 24

        ctx.moveTo(minorX, tickY)
        ctx.lineTo(minorX, height)
      }
    }

    ctx.stroke()
  }

  useEffect(() => {
    const updateWidth = () => {
      if (scrollContainerRef.current) {
        setWidth(scrollContainerRef.current.clientWidth)
      }
    }

    window.addEventListener("resize", updateWidth)
    // Check immediately and periodically to ensure sync with parent resize
    updateWidth()
    const interval = setInterval(updateWidth, 500)

    return () => {
      window.removeEventListener("resize", updateWidth)
      clearInterval(interval)
    }
  }, [scrollContainerRef])

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current
    const container = scrollContainerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    // Always match display size
    if (canvas.width !== width * dpr || canvas.height !== 32 * dpr) {
      canvas.width = width * dpr
      canvas.height = 32 * dpr
      ctx.scale(dpr, dpr)
    }
    canvas.style.width = `${width}px`
    canvas.style.height = `32px`

    let animationFrameId: number

    const render = () => {
      draw(ctx, container.scrollLeft, width)
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => cancelAnimationFrame(animationFrameId)
  }, [width, zoomLevel, duration, scrollContainerRef])

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!onClick || !scrollContainerRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const scrollLeft = scrollContainerRef.current.scrollLeft
    const time = Math.max(0, (x + scrollLeft) / zoomLevel)
    onClick(time)
  }

  return (
    <div className="h-8 w-full sticky top-0 left-0 z-30 bg-[var(--surface-0)] border-b border-[var(--border-default)] pointer-events-auto overflow-hidden">
      <canvas ref={canvasRef} className="block w-full h-full cursor-pointer" onClick={handleCanvasClick} />
    </div>
  )
}
