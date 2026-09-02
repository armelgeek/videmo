# Clip-Based Annotations Architecture

**Date:** 2026-09-02  
**Status:** Design Document (awaiting approval)  
**Author:** Claude Code (brainstorming session)

---

## Executive Summary

This document specifies the architecture for managing annotations (labels, regions, reveal animations, hand-drawn paths) per timeline clip. Each clip instance can have its own independent set of annotations, created and managed entirely by the user within the UI. Annotations are stored in Prisma, displayed with absolute project timecodes, and support lazy-loading for performance.

---

## 1. Design Principles

- **Per-Instance Annotations:** Each clip on the timeline has independent annotations, even if they reference the same source media.
- **User-Created:** Clips start with no annotations. Users create them manually via the UI.
- **Absolute Timecodes:** UI displays timecodes relative to the project timeline, not the clip.
- **Lazy-Loaded:** Annotations load only when a clip is selected, keeping the timeline responsive.
- **BD as Source of Truth:** Prisma DB is the persistent store; Python JSON files are optional references.

---

## 2. Data Model (Prisma)

### TimelineClip (existing, enhanced)

```prisma
model TimelineClip {
  id        String   @id @default(cuid())
  mediaId   String
  trackId   String
  start     Float    // Start time on timeline (seconds)
  duration  Float    // Duration (seconds)
  offset    Float    // Start within source media (seconds)
  speed     Float    @default(1)
  volume    Float    @default(1)
  isLocked  Boolean  @default(false)
  
  // Relations
  annotations Annotation[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([trackId])
}
```

### Annotation (new)

```prisma
model Annotation {
  id        String   @id @default(cuid())
  clipId    String
  clip      TimelineClip @relation(fields: [clipId], references: [id], onDelete: Cascade)
  
  // Display & metadata
  label     String   @db.VarChar(255)        // "Sac à main", "Titre Premium Image"
  type      String   @db.VarChar(50)         // "text", "object", "prop", "symbol", "structure"
  narrativeRole String? @db.VarChar(255)
  subtitle  String?  @db.Text
  sequence  Int?     // Order in reveal sequence
  
  // Spatial: bounding box on canvas
  region    Json     // { x: number, y: number, width: number, height: number }
  
  // Timing: relative to clip start (milliseconds)
  startMs   Int      // Start time within clip (ms)
  durationMs Int     // Duration of reveal (ms)
  
  // Reveal animation configuration
  reveal    Json     // {
            //   direction: "top_to_bottom" | "bottom_to_top" | "left_to_right" | "right_to_left",
            //   style: "iris" | "wipe" | "",
            //   maskPaddingPx: number,
            //   protectedRegions: []
            // }
  
  // Hand-drawn path animation
  handPath  Json     // {
            //   start: [x: number, y: number],
            //   end: [x: number, y: number],
            //   easing: "easeInOut" | "easeIn" | "easeOut" | "linear"
            // }
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([clipId])
}
```

### Type Definitions (TypeScript)

```typescript
// lib/editor/types.ts

export interface Annotation {
  id: string
  clipId: string
  label: string
  type: 'text' | 'object' | 'prop' | 'symbol' | 'structure'
  region: {
    x: number
    y: number
    width: number
    height: number
  }
  startMs: number        // Relative to clip start
  durationMs: number
  reveal: {
    direction: 'top_to_bottom' | 'bottom_to_top' | 'left_to_right' | 'right_to_left'
    style: 'iris' | 'wipe' | ''
    maskPaddingPx: number
    protectedRegions: any[]
  }
  handPath: {
    start: [number, number]
    end: [number, number]
    easing: 'easeInOut' | 'easeIn' | 'easeOut' | 'linear'
  }
  narrativeRole?: string
  sequence?: number
  subtitle?: string
  createdAt: Date
  updatedAt: Date
}

export interface AnnotationDisplay extends Annotation {
  absoluteStartSeconds: number  // Calculated: clip.start + startMs/1000
  absoluteEndSeconds: number
}
```

---

## 3. Frontend Architecture

### Component Hierarchy

```
<EditorPage>
  ├─ useTimelineState()           // Existing timeline state
  ├─ selectedClipId (state)       // NEW: Track selected clip
  │
  ├─ <TimelineView>
  │  ├─ <Track /> (video, audio, text)
  │  │  └─ <TimelineClip 
  │  │     onClick={() => setSelectedClipId(clipId)}
  │  │     isSelected={selectedClipId === clipId}
  │  │    />
  │
  └─ <AnnotationsPanel>
     ├─ Props: selectedClipId, selectedClip
     └─ useAnnotations(selectedClipId)
        ├─ Fetches annotations from API
        ├─ Auto re-fetches on clip change
        └─ Provides CRUD actions
```

### useAnnotations Hook

**Location:** `lib/editor/hooks/use-annotations.ts`

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Annotation } from '../types'
import { api } from '@/lib/client'

export function useAnnotations(clipId: string | null) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch annotations when clipId changes
  useEffect(() => {
    if (!clipId) {
      setAnnotations([])
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    api
      .get(`/api/clips/${clipId}/annotations`)
      .then((res) => {
        if (!res.ok) throw new Error(res.error)
        setAnnotations(res.data || [])
      })
      .catch((err) => {
        setError(err.message || 'Failed to load annotations')
      })
      .finally(() => setIsLoading(false))
  }, [clipId])

  // Add annotation
  const addAnnotation = useCallback(
    async (data: Omit<Annotation, 'id' | 'clipId' | 'createdAt' | 'updatedAt'>) => {
      if (!clipId) return

      try {
        const res = await api.post(`/api/clips/${clipId}/annotations`, data)
        if (!res.ok) throw new Error(res.error)
        setAnnotations((prev) => [...prev, res.data])
        return res.data
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add annotation')
        throw err
      }
    },
    [clipId]
  )

  // Update annotation
  const updateAnnotation = useCallback(
    async (annotationId: string, data: Partial<Annotation>) => {
      if (!clipId) return

      try {
        const res = await api.patch(
          `/api/clips/${clipId}/annotations/${annotationId}`,
          data
        )
        if (!res.ok) throw new Error(res.error)
        setAnnotations((prev) =>
          prev.map((a) => (a.id === annotationId ? res.data : a))
        )
        return res.data
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update annotation')
        throw err
      }
    },
    [clipId]
  )

  // Delete annotation
  const deleteAnnotation = useCallback(
    async (annotationId: string) => {
      if (!clipId) return

      try {
        const res = await api.delete(
          `/api/clips/${clipId}/annotations/${annotationId}`
        )
        if (!res.ok) throw new Error(res.error)
        setAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete annotation')
        throw err
      }
    },
    [clipId]
  )

  return {
    annotations,
    isLoading,
    error,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
  }
}
```

### AnnotationsPanel Component

**Location:** `lib/editor/components/annotations-panel.tsx`

```typescript
'use client'

import React from 'react'
import type { TimelineClip, Annotation } from '../types'
import { useAnnotations } from '../hooks/use-annotations'
import { formatTime } from '@/lib/utils/time'
import { Button } from '@/components/ui/button'
import { Trash2, Plus } from 'lucide-react'

interface AnnotationsPanelProps {
  selectedClip: TimelineClip | null
  onAddAnnotation?: () => void
}

export function AnnotationsPanel({
  selectedClip,
  onAddAnnotation,
}: AnnotationsPanelProps) {
  const { annotations, isLoading, addAnnotation, deleteAnnotation } =
    useAnnotations(selectedClip?.id ?? null)

  const getAbsoluteTime = (annotationStartMs: number): number => {
    if (!selectedClip) return 0
    return selectedClip.start + annotationStartMs / 1000
  }

  if (!selectedClip) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Select a clip to view annotations
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 border-t">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Annotations</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={onAddAnnotation}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}

      {!isLoading && annotations.length === 0 && (
        <div className="text-sm text-muted-foreground">No annotations yet</div>
      )}

      <div className="space-y-2">
        {annotations.map((annotation) => {
          const absStart = getAbsoluteTime(annotation.startMs)
          const absEnd = absStart + annotation.durationMs / 1000

          return (
            <div
              key={annotation.id}
              className="flex items-start justify-between gap-3 rounded-md border p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{annotation.label}</p>
                <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                  <span>{formatTime(absStart)}</span>
                  <span>→</span>
                  <span>{formatTime(absEnd)}</span>
                </div>
                {annotation.narrativeRole && (
                  <p className="mt-1 text-xs">{annotation.narrativeRole}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteAnnotation(annotation.id)}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

---

## 4. API Routes

### GET /api/clips/{clipId}/annotations

**Fetch annotations for a clip**

```typescript
// app/api/clips/[clipId]/annotations/route.ts
import { db } from '@/lib/database'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { clipId: string } }
) {
  try {
    const { clipId } = params

    // Verify clip exists
    const clip = await db.timelineClip.findUnique({
      where: { id: clipId },
    })
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    // Fetch annotations
    const annotations = await db.annotation.findMany({
      where: { clipId },
      orderBy: { sequence: 'asc' },
    })

    return NextResponse.json(annotations)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch' },
      { status: 500 }
    )
  }
}
```

### POST /api/clips/{clipId}/annotations

**Create annotation**

```typescript
// Zod schema
import { z } from 'zod'

const CreateAnnotationSchema = z.object({
  label: z.string().min(1).max(255),
  type: z.enum(['text', 'object', 'prop', 'symbol', 'structure']),
  region: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(1),
    height: z.number().min(1),
  }),
  startMs: z.number().min(0),
  durationMs: z.number().min(1),
  reveal: z.object({
    direction: z.enum([
      'top_to_bottom',
      'bottom_to_top',
      'left_to_right',
      'right_to_left',
    ]),
    style: z.enum(['iris', 'wipe', '']),
    maskPaddingPx: z.number().min(0),
    protectedRegions: z.array(z.any()).default([]),
  }),
  handPath: z.object({
    start: z.tuple([z.number(), z.number()]),
    end: z.tuple([z.number(), z.number()]),
    easing: z.enum(['easeInOut', 'easeIn', 'easeOut', 'linear']),
  }),
  narrativeRole: z.string().optional(),
  sequence: z.number().optional(),
  subtitle: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { clipId: string } }
) {
  try {
    const { clipId } = params
    const body = await request.json()

    // Verify clip exists
    const clip = await db.timelineClip.findUnique({
      where: { id: clipId },
    })
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    // Validate input
    const validated = CreateAnnotationSchema.parse(body)

    // Create annotation
    const annotation = await db.annotation.create({
      data: {
        ...validated,
        clipId,
      },
    })

    return NextResponse.json(annotation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create' },
      { status: 500 }
    )
  }
}
```

### PATCH /api/clips/{clipId}/annotations/{annotationId}

**Update annotation**

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { clipId: string; annotationId: string } }
) {
  try {
    const { clipId, annotationId } = params
    const body = await request.json()

    // Verify annotation belongs to clip
    const annotation = await db.annotation.findUnique({
      where: { id: annotationId },
    })
    if (!annotation || annotation.clipId !== clipId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Update (partial validation)
    const updated = await db.annotation.update({
      where: { id: annotationId },
      data: body,
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 500 }
    )
  }
}
```

### DELETE /api/clips/{clipId}/annotations/{annotationId}

**Delete annotation**

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { clipId: string; annotationId: string } }
) {
  try {
    const { clipId, annotationId } = params

    // Verify annotation belongs to clip
    const annotation = await db.annotation.findUnique({
      where: { id: annotationId },
    })
    if (!annotation || annotation.clipId !== clipId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Delete
    await db.annotation.delete({
      where: { id: annotationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete' },
      { status: 500 }
    )
  }
}
```

---

## 5. Timecode Mapping

### Concept

Annotations store **relative timecodes** (milliseconds from clip start). The UI displays **absolute timecodes** (seconds from project start).

```
Clip A: starts at 5.0s, duration 11.7s
├─ Annotation 1: startMs=300 → absolute = 5.0 + 0.3 = 5.3s → display "0:00:05.300"
├─ Annotation 2: startMs=2000 → absolute = 5.0 + 2.0 = 7.0s → display "0:00:07.000"
└─ Annotation 3: startMs=5500 → absolute = 5.0 + 5.5 = 10.5s → display "0:00:10.500"
```

### Utility Functions

```typescript
// lib/utils/time.ts

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
```

### Display in UI

```typescript
// In AnnotationsPanel component
const absStart = getAbsoluteAnnotationTime(selectedClip, annotation.startMs)
const absEnd = absStart + annotation.durationMs / 1000

return (
  <div>
    <span>{formatTime(absStart)}</span>
    <span>→</span>
    <span>{formatTime(absEnd)}</span>
  </div>
)
```

### Re-render on Clip Move

When a clip is dragged on the timeline, its `start` time changes. The AnnotationsPanel automatically re-renders because:

1. `selectedClip.start` is updated in state
2. `useAnnotations()` keeps the same `clipId`
3. Component re-renders with new `selectedClip` reference
4. `getAbsoluteAnnotationTime()` recalculates with new `clip.start`

---

## 6. Python Integration

### Workflow

**Python generates** `annotations/clip-{clipId}.json` with the structure:

```json
{
  "sceneId": "clip-123",
  "name": "Scene",
  "sceneDurationMs": 11700,
  "elements": [
    {
      "id": "element-1",
      "label": "Title",
      "type": "text",
      "region": { "x": 100, "y": 75, "width": 680, "height": 117 },
      "reveal": {
        "direction": "bottom_to_top",
        "style": "iris",
        "startMs": 300,
        "durationMs": 1600,
        "maskPaddingPx": 22,
        "protectedRegions": []
      },
      "handPath": {
        "start": [440, 133.5],
        "end": [440, 192],
        "easing": "easeInOut"
      },
      "narrativeRole": "Hook/Title",
      "sequence": 1,
      "subtitle": "..."
    }
  ]
}
```

### Import Method (Recommended)

**Admin endpoint to import JSON files:**

```typescript
// app/api/admin/annotations/import/route.ts

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clipId, annotationJson } = body

    // Verify clip exists
    const clip = await db.timelineClip.findUnique({ where: { id: clipId } })
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    // Normalize Python JSON to Annotation records
    const annotations = annotationJson.elements.map((el: any) => ({
      label: el.label,
      type: el.type,
      region: el.region,
      startMs: el.reveal.startMs,
      durationMs: el.reveal.durationMs,
      reveal: {
        direction: el.reveal.direction,
        style: el.reveal.style,
        maskPaddingPx: el.reveal.maskPaddingPx,
        protectedRegions: el.reveal.protectedRegions,
      },
      handPath: el.handPath,
      narrativeRole: el.narrativeRole,
      sequence: el.sequence,
      subtitle: el.subtitle,
      clipId,
    }))

    // Bulk create
    await db.annotation.createMany({ data: annotations })

    return NextResponse.json({
      success: true,
      imported: annotations.length,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**CLI script to batch import:**

```typescript
// scripts/import-annotations.ts
import fs from 'fs'
import path from 'path'
import { db } from '@/lib/database'

async function importAnnotations(annotationsDir: string) {
  const files = fs.readdirSync(annotationsDir)
  
  for (const file of files) {
    if (!file.startsWith('clip-') || !file.endsWith('.json')) continue
    
    const clipId = file.replace('clip-', '').replace('.json', '')
    const jsonPath = path.join(annotationsDir, file)
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
    
    console.log(`Importing ${file} (clipId: ${clipId})...`)
    
    // Fetch via admin endpoint
    await fetch('http://localhost:3000/api/admin/annotations/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipId, annotationJson: data }),
    })
  }
  
  console.log('Import complete!')
}

importAnnotations('./annotations')
```

---

## 7. State Management Integration

### EditorPage Setup

```typescript
// app/(protected)/editor/page.tsx
'use client'

import { useState } from 'react'
import { useTimelineState } from '@/lib/editor/hooks/use-timeline-state'
import { TimelineView } from '@/lib/editor/components/timeline'
import { AnnotationsPanel } from '@/lib/editor/components/annotations-panel'

export default function EditorPage() {
  const timelineState = useTimelineState()
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)

  const selectedClip = selectedClipId
    ? timelineState.timelineClips.find((c) => c.id === selectedClipId) || null
    : null

  return (
    <div className="flex h-full gap-4">
      <div className="flex-1">
        <TimelineView
          {...timelineState}
          selectedClipIds={selectedClipId ? [selectedClipId] : []}
          onSelectClip={(clipId) => setSelectedClipId(clipId)}
        />
      </div>
      
      <div className="w-80 border-l bg-background">
        <AnnotationsPanel selectedClip={selectedClip} />
      </div>
    </div>
  )
}
```

---

## 8. Error Handling & Validation

### Client-Side

- Show loading state while fetching annotations
- Display error toast if fetch fails
- Validate form input before submission
- Disable UI during network operations

### Server-Side

- Verify clip exists before operations
- Verify annotation belongs to clip (on update/delete)
- Validate Zod schema strictly
- Return meaningful error messages
- Log all errors for debugging

---

## 9. Testing Strategy

### Unit Tests

- `useAnnotations()` hook: fetch, add, update, delete
- Timecode mapping functions
- Prisma queries

### Integration Tests

- API endpoints: GET, POST, PATCH, DELETE
- Clip selection → annotation fetch
- Python import workflow

### E2E Tests

- Add clip → select clip → annotations load
- Edit annotation → UI updates + DB persists
- Move clip → timecodes recalculate
- Delete annotation → removed from UI and DB

---

## 10. Migration & Rollout

### Phase 1: Schema & API (No UI changes)

1. Create Prisma migration: `TimelineClip` relation + `Annotation` model
2. Implement API routes
3. Test with direct API calls (curl/Postman)

### Phase 2: Frontend (UI wired)

1. Add `useAnnotations()` hook
2. Add `AnnotationsPanel` component
3. Wire up `selectedClipId` state in EditorPage
4. Test UI locally

### Phase 3: Python Integration (Optional)

1. Create admin import endpoint
2. Create CLI script
3. Run import on existing projects

### Phase 4: Rollout

1. Deploy migrations + API
2. Deploy frontend
3. (Optional) Backfill annotations via Python import

---

## 11. Future Enhancements

- Bulk import/export annotations as CSV
- Annotation templates (reusable sets)
- Annotation versioning / history
- Collaboration: shared editing of annotations
- Annotation playback in preview (render on canvas during playback)
- Search/filter annotations by label, type, time range

---

## Appendix: File Structure

```
app/
├── api/
│   ├── clips/
│   │   └── [clipId]/
│   │       └── annotations/
│   │           └── route.ts        (GET, POST)
│   │           └── [annotationId]/
│   │               └── route.ts    (PATCH, DELETE)
│   └── admin/
│       └── annotations/
│           └── import/
│               └── route.ts        (POST)

lib/
├── editor/
│   ├── hooks/
│   │   └── use-annotations.ts      (NEW)
│   ├── components/
│   │   └── annotations-panel.tsx   (NEW)
│   └── types.ts                    (updated: add Annotation)
├── utils/
│   └── time.ts                     (timecode formatting)

scripts/
└── import-annotations.ts            (NEW, optional)

docs/
└── superpowers/
    └── specs/
        └── 2026-09-02-clip-annotations-design.md (this file)
```

---

## Summary

This design introduces a per-clip annotation system with:
- **Lazy-loaded** annotations (fetch when clip selected)
- **Absolute timecode display** (project global, not clip-relative)
- **BD-backed persistence** (Prisma, not JSON)
- **Clean API surface** for CRUD operations
- **Optional Python integration** (import existing annotations)

All decisions prioritize **user control** (annotations created manually) and **performance** (lazy-load, per-clip isolation).

