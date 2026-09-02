# Clip Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a per-clip annotation system where users can create, edit, and delete annotations with lazy-loading, absolute timecodes, and BD persistence.

**Architecture:** Annotations are independent per clip instance (not shared). They load on-demand when a clip is selected, store timecodes relative to the clip (in Ms), and display as absolute project time. API provides CRUD endpoints; Python JSON is optional reference.

**Tech Stack:** Next.js 16.1.6, React, TypeScript (strict), Prisma ORM, PostgreSQL, Zod, shadcn/ui, Biome

**Spec:** `docs/superpowers/specs/2026-09-02-clip-annotations-design.md`

## Global Constraints

- TypeScript strict mode enforced
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`
- Biome formatting on save
- Zod validation at all input boundaries
- shadcn/ui for components where applicable
- Tests use Vitest + testing-library
- No external dependencies without spec approval

---

## File Structure

### New Files (to create)

```
lib/editor/
├── hooks/
│   └── use-annotations.ts          (useAnnotations hook)
├── components/
│   └── annotations-panel.tsx       (AnnotationsPanel component)

lib/utils/
└── time.ts                         (formatTime, timecode helpers)

app/api/clips/[clipId]/
└── annotations/
    ├── route.ts                    (GET, POST handlers)
    └── [annotationId]/
        └── route.ts                (PATCH, DELETE handlers)

app/api/admin/
└── annotations/
    └── import/
        └── route.ts                (POST admin import endpoint)

scripts/
└── import-annotations.ts           (CLI for batch import, optional)

tests/
├── lib/editor/hooks/
│   └── use-annotations.test.ts
├── lib/utils/
│   └── time.test.ts
└── app/api/clips/
    └── annotations.test.ts
```

### Modified Files

```
prisma/schema.prisma                (add Annotation model, TimelineClip.annotations relation)
lib/editor/types.ts                 (add Annotation, AnnotationDisplay types)
app/(protected)/editor/page.tsx     (add selectedClipId state, pass to AnnotationsPanel)
```

---

# Tasks

## Phase 1: Schema & Validation

### Task 1: Add Annotation Model to Prisma

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_annotations/migration.sql`

**Interfaces:**
- Consumes: (none — foundation task)
- Produces: 
  - Prisma model `Annotation` with fields: `id`, `clipId`, `label`, `type`, `region`, `startMs`, `durationMs`, `reveal`, `handPath`, `narrativeRole`, `sequence`, `subtitle`, `createdAt`, `updatedAt`
  - Relation `TimelineClip.annotations Annotation[]`

**Steps:**

- [ ] **Step 1: Add Annotation model to schema**

Open `prisma/schema.prisma` and add after the `TimelineClip` model:

```prisma
model Annotation {
  id        String   @id @default(cuid())
  clipId    String
  clip      TimelineClip @relation(fields: [clipId], references: [id], onDelete: Cascade)
  
  // Display & metadata
  label     String   @db.VarChar(255)
  type      String   @db.VarChar(50)
  narrativeRole String? @db.VarChar(255)
  subtitle  String?  @db.Text
  sequence  Int?
  
  // Spatial: bounding box on canvas
  region    Json     // { x: number, y: number, width: number, height: number }
  
  // Timing: relative to clip start (milliseconds)
  startMs   Int      // Start time within clip (ms)
  durationMs Int     // Duration of reveal (ms)
  
  // Reveal animation
  reveal    Json     // { direction, style, maskPaddingPx, protectedRegions }
  
  // Hand-drawn path
  handPath  Json     // { start: [x, y], end: [x, y], easing }
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([clipId])
}
```

Also update `TimelineClip` to add the relation (if not already there):

```prisma
model TimelineClip {
  // ... existing fields ...
  annotations Annotation[]
  // ... rest of model ...
}
```

- [ ] **Step 2: Generate migration**

Run:
```bash
npx prisma migrate dev --name add_annotations
```

Expected: Migration file created in `prisma/migrations/<timestamp>_add_annotations/`

- [ ] **Step 3: Verify schema loads**

Run:
```bash
npx prisma generate
```

Expected: No errors, Prisma client regenerated

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add annotation model to prisma schema"
```

---

### Task 2: Add TypeScript Types for Annotations

**Files:**
- Modify: `lib/editor/types.ts`

**Interfaces:**
- Consumes: (none)
- Produces:
  - Type `Annotation` (core data)
  - Type `AnnotationDisplay` (with calculated absolute times)
  - Zod schema `CreateAnnotationSchema`
  - Zod schema `UpdateAnnotationSchema`

**Steps:**

- [ ] **Step 1: Add Annotation type**

Open `lib/editor/types.ts` and add at the end:

```typescript
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

- [ ] **Step 2: Add Zod schemas**

In the same file, add at the end:

```typescript
import { z } from 'zod'

export const AnnotationRegionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(1),
  height: z.number().min(1),
})

export const AnnotationRevealSchema = z.object({
  direction: z.enum(['top_to_bottom', 'bottom_to_top', 'left_to_right', 'right_to_left']),
  style: z.enum(['iris', 'wipe', '']),
  maskPaddingPx: z.number().min(0),
  protectedRegions: z.array(z.any()).default([]),
})

export const AnnotationHandPathSchema = z.object({
  start: z.tuple([z.number(), z.number()]),
  end: z.tuple([z.number(), z.number()]),
  easing: z.enum(['easeInOut', 'easeIn', 'easeOut', 'linear']),
})

export const CreateAnnotationSchema = z.object({
  label: z.string().min(1).max(255),
  type: z.enum(['text', 'object', 'prop', 'symbol', 'structure']),
  region: AnnotationRegionSchema,
  startMs: z.number().min(0),
  durationMs: z.number().min(1),
  reveal: AnnotationRevealSchema,
  handPath: AnnotationHandPathSchema,
  narrativeRole: z.string().optional(),
  sequence: z.number().optional(),
  subtitle: z.string().optional(),
})

export const UpdateAnnotationSchema = CreateAnnotationSchema.partial()
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
npm run build
```

Expected: Build succeeds with no TS errors

- [ ] **Step 4: Commit**

```bash
git add lib/editor/types.ts
git commit -m "feat: add annotation types and zod schemas"
```

---

## Phase 2: Time Utilities

### Task 3: Create Time Formatting Utilities

**Files:**
- Create: `lib/utils/time.ts`
- Create: `tests/lib/utils/time.test.ts`

**Interfaces:**
- Consumes: (none)
- Produces:
  - Function `formatTime(seconds: number) => string`
  - Function `getAbsoluteAnnotationTime(clip: TimelineClip, annotationStartMs: number) => number`
  - Function `getAbsoluteAnnotationRange(clip: TimelineClip, annotation: Annotation) => { start: number; end: number }`

**Steps:**

- [ ] **Step 1: Write tests first (TDD)**

Create `tests/lib/utils/time.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  formatTime,
  getAbsoluteAnnotationTime,
  getAbsoluteAnnotationRange,
} from '@/lib/utils/time'
import type { TimelineClip, Annotation } from '@/lib/editor/types'

describe('time utilities', () => {
  describe('formatTime', () => {
    it('formats seconds to HH:MM:SS.ms format', () => {
      expect(formatTime(0)).toBe('0:00:00.000')
      expect(formatTime(5.3)).toBe('0:00:05.300')
      expect(formatTime(65.5)).toBe('0:01:05.500')
      expect(formatTime(3661.123)).toBe('1:01:01.123')
    })

    it('pads with zeros', () => {
      expect(formatTime(5)).toBe('0:00:05.000')
      expect(formatTime(60)).toBe('0:01:00.000')
    })
  })

  describe('getAbsoluteAnnotationTime', () => {
    it('calculates absolute time from clip start + relative Ms', () => {
      const clip: TimelineClip = {
        id: 'clip-1',
        mediaId: 'media-1',
        trackId: 'v1',
        start: 5.0,
        duration: 11.7,
        offset: 0,
        speed: 1,
        volume: 1,
      }

      const absTime = getAbsoluteAnnotationTime(clip, 300)
      expect(absTime).toBeCloseTo(5.3, 5)
    })

    it('handles zero relative time', () => {
      const clip: TimelineClip = {
        id: 'clip-1',
        mediaId: 'media-1',
        trackId: 'v1',
        start: 10.0,
        duration: 5.0,
        offset: 0,
        speed: 1,
        volume: 1,
      }

      expect(getAbsoluteAnnotationTime(clip, 0)).toBe(10.0)
    })
  })

  describe('getAbsoluteAnnotationRange', () => {
    it('calculates start and end times', () => {
      const clip: TimelineClip = {
        id: 'clip-1',
        mediaId: 'media-1',
        trackId: 'v1',
        start: 5.0,
        duration: 11.7,
        offset: 0,
        speed: 1,
        volume: 1,
      }

      const annotation: Annotation = {
        id: 'ann-1',
        clipId: 'clip-1',
        label: 'Test',
        type: 'text',
        region: { x: 0, y: 0, width: 100, height: 100 },
        startMs: 300,
        durationMs: 1600,
        reveal: { direction: 'top_to_bottom', style: 'iris', maskPaddingPx: 22, protectedRegions: [] },
        handPath: { start: [0, 0], end: [0, 0], easing: 'easeInOut' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const range = getAbsoluteAnnotationRange(clip, annotation)
      expect(range.start).toBeCloseTo(5.3, 5)
      expect(range.end).toBeCloseTo(6.9, 5)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/lib/utils/time.test.ts
```

Expected: FAIL (functions not defined)

- [ ] **Step 3: Implement functions**

Create `lib/utils/time.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/lib/utils/time.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/utils/time.ts tests/lib/utils/time.test.ts
git commit -m "feat: add time formatting utilities"
```

---

## Phase 3: API Routes

### Task 4: Implement GET /api/clips/{clipId}/annotations

**Files:**
- Create: `app/api/clips/[clipId]/annotations/route.ts`
- Create: `tests/app/api/clips/annotations.test.ts`

**Interfaces:**
- Consumes: `Annotation` type, `TimelineClip` in DB
- Produces: GET endpoint returning `Annotation[]` or error

**Steps:**

- [ ] **Step 1: Write tests for GET endpoint**

Create `tests/app/api/clips/annotations.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GET } from '@/app/api/clips/[clipId]/annotations/route'
import { db } from '@/lib/database'

describe('GET /api/clips/[clipId]/annotations', () => {
  let clipId: string

  beforeAll(async () => {
    // Create test clip
    const clip = await db.timelineClip.create({
      data: {
        id: 'test-clip-1',
        mediaId: 'media-1',
        trackId: 'v1',
        start: 5.0,
        duration: 11.7,
        offset: 0,
        speed: 1,
      },
    })
    clipId = clip.id

    // Create test annotations
    await db.annotation.createMany({
      data: [
        {
          clipId,
          label: 'Ann 1',
          type: 'text',
          region: { x: 0, y: 0, width: 100, height: 100 },
          startMs: 300,
          durationMs: 1600,
          reveal: { direction: 'top_to_bottom', style: 'iris', maskPaddingPx: 22, protectedRegions: [] },
          handPath: { start: [0, 0], end: [0, 0], easing: 'easeInOut' },
          sequence: 1,
        },
        {
          clipId,
          label: 'Ann 2',
          type: 'object',
          region: { x: 100, y: 100, width: 200, height: 200 },
          startMs: 2000,
          durationMs: 3400,
          reveal: { direction: 'left_to_right', style: '', maskPaddingPx: 22, protectedRegions: [] },
          handPath: { start: [0, 0], end: [0, 0], easing: 'linear' },
          sequence: 2,
        },
      ],
    })
  })

  afterAll(async () => {
    await db.annotation.deleteMany({ where: { clipId } })
    await db.timelineClip.delete({ where: { id: clipId } })
  })

  it('returns annotations for a clip', async () => {
    const req = new Request('http://localhost/api/clips/' + clipId + '/annotations')
    const res = await GET(req, { params: { clipId } })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(2)
    expect(data[0].label).toBe('Ann 1')
  })

  it('returns 404 for non-existent clip', async () => {
    const req = new Request('http://localhost/api/clips/non-existent/annotations')
    const res = await GET(req, { params: { clipId: 'non-existent' } })

    expect(res.status).toBe(404)
  })

  it('returns empty array for clip with no annotations', async () => {
    const emptyClip = await db.timelineClip.create({
      data: {
        id: 'empty-clip',
        mediaId: 'media-2',
        trackId: 'v1',
        start: 0,
        duration: 5,
        offset: 0,
        speed: 1,
      },
    })

    const req = new Request('http://localhost/api/clips/empty-clip/annotations')
    const res = await GET(req, { params: { clipId: 'empty-clip' } })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual([])

    await db.timelineClip.delete({ where: { id: 'empty-clip' } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/app/api/clips/annotations.test.ts
```

Expected: FAIL (route not implemented)

- [ ] **Step 3: Implement GET route**

Create `app/api/clips/[clipId]/annotations/route.ts`:

```typescript
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

    // Fetch annotations ordered by sequence
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/app/api/clips/annotations.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/clips/\[clipId\]/annotations/route.ts tests/app/api/clips/annotations.test.ts
git commit -m "feat: implement GET /api/clips/:clipId/annotations"
```

---

### Task 5: Implement POST /api/clips/{clipId}/annotations

**Files:**
- Modify: `app/api/clips/[clipId]/annotations/route.ts`
- Modify: `tests/app/api/clips/annotations.test.ts`

**Interfaces:**
- Consumes: `CreateAnnotationSchema` (Zod), `TimelineClip` in DB
- Produces: POST endpoint creating `Annotation`, returning 201 + created object

**Steps:**

- [ ] **Step 1: Add test for POST**

In `tests/app/api/clips/annotations.test.ts`, add to the describe block:

```typescript
describe('POST /api/clips/[clipId]/annotations', () => {
  let clipId: string

  beforeEach(async () => {
    const clip = await db.timelineClip.create({
      data: {
        id: 'post-test-clip',
        mediaId: 'media-1',
        trackId: 'v1',
        start: 0,
        duration: 10,
        offset: 0,
        speed: 1,
      },
    })
    clipId = clip.id
  })

  afterEach(async () => {
    await db.annotation.deleteMany({ where: { clipId } })
    await db.timelineClip.delete({ where: { id: clipId } })
  })

  it('creates an annotation', async () => {
    const body = {
      label: 'New Annotation',
      type: 'text',
      region: { x: 10, y: 20, width: 100, height: 50 },
      startMs: 500,
      durationMs: 2000,
      reveal: { direction: 'top_to_bottom', style: 'iris', maskPaddingPx: 22, protectedRegions: [] },
      handPath: { start: [0, 0], end: [100, 100], easing: 'easeInOut' },
      narrativeRole: 'Main element',
      sequence: 1,
    }

    const req = new Request('http://localhost/api/clips/' + clipId + '/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const res = await POST(req, { params: { clipId } })
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.id).toBeDefined()
    expect(data.label).toBe('New Annotation')
    expect(data.clipId).toBe(clipId)
  })

  it('validates input and returns 400 on invalid data', async () => {
    const body = {
      label: '', // Invalid: empty label
      type: 'text',
      region: { x: 10, y: 20, width: 100, height: 50 },
      startMs: 500,
      durationMs: 2000,
      reveal: { direction: 'top_to_bottom', style: 'iris', maskPaddingPx: 22, protectedRegions: [] },
      handPath: { start: [0, 0], end: [100, 100], easing: 'easeInOut' },
    }

    const req = new Request('http://localhost/api/clips/' + clipId + '/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const res = await POST(req, { params: { clipId } })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent clip', async () => {
    const body = {
      label: 'Test',
      type: 'text',
      region: { x: 0, y: 0, width: 100, height: 100 },
      startMs: 0,
      durationMs: 1000,
      reveal: { direction: 'top_to_bottom', style: '', maskPaddingPx: 22, protectedRegions: [] },
      handPath: { start: [0, 0], end: [0, 0], easing: 'linear' },
    }

    const req = new Request('http://localhost/api/clips/non-existent/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const res = await POST(req, { params: { clipId: 'non-existent' } })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/app/api/clips/annotations.test.ts
```

Expected: FAIL (POST not implemented)

- [ ] **Step 3: Add POST handler**

In `app/api/clips/[clipId]/annotations/route.ts`, add:

```typescript
import { CreateAnnotationSchema } from '@/lib/editor/types'
import { z } from 'zod'

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
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/app/api/clips/annotations.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/clips/\[clipId\]/annotations/route.ts tests/app/api/clips/annotations.test.ts
git commit -m "feat: implement POST /api/clips/:clipId/annotations"
```

---

### Task 6: Implement PATCH & DELETE for Annotations

**Files:**
- Create: `app/api/clips/[clipId]/annotations/[annotationId]/route.ts`
- Modify: `tests/app/api/clips/annotations.test.ts`

**Interfaces:**
- Consumes: `UpdateAnnotationSchema` (Zod partial), `Annotation` in DB
- Produces: PATCH endpoint updating annotation, DELETE endpoint removing annotation

**Steps:**

- [ ] **Step 1: Add tests for PATCH and DELETE**

In `tests/app/api/clips/annotations.test.ts`, add:

```typescript
describe('PATCH /api/clips/[clipId]/annotations/[annotationId]', () => {
  let clipId: string
  let annotationId: string

  beforeEach(async () => {
    const clip = await db.timelineClip.create({
      data: {
        id: 'patch-test-clip',
        mediaId: 'media-1',
        trackId: 'v1',
        start: 0,
        duration: 10,
        offset: 0,
        speed: 1,
      },
    })
    clipId = clip.id

    const ann = await db.annotation.create({
      data: {
        clipId,
        label: 'Original Label',
        type: 'text',
        region: { x: 0, y: 0, width: 100, height: 100 },
        startMs: 0,
        durationMs: 1000,
        reveal: { direction: 'top_to_bottom', style: '', maskPaddingPx: 22, protectedRegions: [] },
        handPath: { start: [0, 0], end: [0, 0], easing: 'linear' },
      },
    })
    annotationId = ann.id
  })

  afterEach(async () => {
    await db.annotation.deleteMany({ where: { clipId } })
    await db.timelineClip.delete({ where: { id: clipId } })
  })

  it('updates annotation label', async () => {
    const body = { label: 'Updated Label' }

    const req = new Request(
      `http://localhost/api/clips/${clipId}/annotations/${annotationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    const res = await PATCH(req, { params: { clipId, annotationId } })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.label).toBe('Updated Label')
  })

  it('returns 404 for non-existent annotation', async () => {
    const body = { label: 'New' }

    const req = new Request(
      `http://localhost/api/clips/${clipId}/annotations/fake-id`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    const res = await PATCH(req, { params: { clipId, annotationId: 'fake-id' } })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/clips/[clipId]/annotations/[annotationId]', () => {
  let clipId: string
  let annotationId: string

  beforeEach(async () => {
    const clip = await db.timelineClip.create({
      data: {
        id: 'delete-test-clip',
        mediaId: 'media-1',
        trackId: 'v1',
        start: 0,
        duration: 10,
        offset: 0,
        speed: 1,
      },
    })
    clipId = clip.id

    const ann = await db.annotation.create({
      data: {
        clipId,
        label: 'To Delete',
        type: 'text',
        region: { x: 0, y: 0, width: 100, height: 100 },
        startMs: 0,
        durationMs: 1000,
        reveal: { direction: 'top_to_bottom', style: '', maskPaddingPx: 22, protectedRegions: [] },
        handPath: { start: [0, 0], end: [0, 0], easing: 'linear' },
      },
    })
    annotationId = ann.id
  })

  afterEach(async () => {
    await db.annotation.deleteMany({ where: { clipId } })
    await db.timelineClip.delete({ where: { id: clipId } })
  })

  it('deletes annotation', async () => {
    const req = new Request(
      `http://localhost/api/clips/${clipId}/annotations/${annotationId}`,
      { method: 'DELETE' }
    )

    const res = await DELETE(req, { params: { clipId, annotationId } })
    expect(res.status).toBe(200)

    // Verify it's gone
    const ann = await db.annotation.findUnique({ where: { id: annotationId } })
    expect(ann).toBeNull()
  })

  it('returns 404 for non-existent annotation', async () => {
    const req = new Request(
      `http://localhost/api/clips/${clipId}/annotations/fake-id`,
      { method: 'DELETE' }
    )

    const res = await DELETE(req, { params: { clipId, annotationId: 'fake-id' } })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/app/api/clips/annotations.test.ts
```

Expected: FAIL (routes not implemented)

- [ ] **Step 3: Implement PATCH and DELETE routes**

Create `app/api/clips/[clipId]/annotations/[annotationId]/route.ts`:

```typescript
import { db } from '@/lib/database'
import { UpdateAnnotationSchema } from '@/lib/editor/types'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

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

    // Validate input (partial)
    const validated = UpdateAnnotationSchema.parse(body)

    // Update
    const updated = await db.annotation.update({
      where: { id: annotationId },
      data: validated,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 500 }
    )
  }
}

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/app/api/clips/annotations.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/clips/\[clipId\]/annotations/\[annotationId\]/route.ts tests/app/api/clips/annotations.test.ts
git commit -m "feat: implement PATCH and DELETE for annotations"
```

---

## Phase 4: Frontend Hooks

### Task 7: Implement useAnnotations Hook

**Files:**
- Create: `lib/editor/hooks/use-annotations.ts`
- Create: `tests/lib/editor/hooks/use-annotations.test.ts`

**Interfaces:**
- Consumes: `api.get()`, `api.post()`, `api.patch()`, `api.delete()` from `@/lib/client`
- Produces:
  - Hook `useAnnotations(clipId: string | null)` returning `{ annotations, isLoading, error, addAnnotation, updateAnnotation, deleteAnnotation }`

**Steps:**

- [ ] **Step 1: Write tests for useAnnotations hook**

Create `tests/lib/editor/hooks/use-annotations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAnnotations } from '@/lib/editor/hooks/use-annotations'
import * as client from '@/lib/client'

vi.mock('@/lib/client')

describe('useAnnotations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches annotations on clip change', async () => {
    const mockAnnotations = [
      {
        id: 'ann-1',
        clipId: 'clip-1',
        label: 'Test',
        type: 'text',
        region: { x: 0, y: 0, width: 100, height: 100 },
        startMs: 0,
        durationMs: 1000,
        reveal: { direction: 'top_to_bottom', style: '', maskPaddingPx: 22, protectedRegions: [] },
        handPath: { start: [0, 0], end: [0, 0], easing: 'linear' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    vi.mocked(client.api.get).mockResolvedValue({ ok: true, data: mockAnnotations })

    const { result } = renderHook(() => useAnnotations('clip-1'))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.annotations).toEqual(mockAnnotations)
    expect(client.api.get).toHaveBeenCalledWith('/api/clips/clip-1/annotations')
  })

  it('clears annotations when clipId is null', () => {
    const { result } = renderHook(() => useAnnotations(null))

    expect(result.current.annotations).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('adds annotation', async () => {
    const newAnnotation = {
      id: 'ann-2',
      clipId: 'clip-1',
      label: 'New',
      type: 'text',
      region: { x: 0, y: 0, width: 100, height: 100 },
      startMs: 100,
      durationMs: 500,
      reveal: { direction: 'top_to_bottom', style: '', maskPaddingPx: 22, protectedRegions: [] },
      handPath: { start: [0, 0], end: [0, 0], easing: 'linear' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(client.api.get).mockResolvedValue({ ok: true, data: [] })
    vi.mocked(client.api.post).mockResolvedValue({ ok: true, data: newAnnotation })

    const { result } = renderHook(() => useAnnotations('clip-1'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.addAnnotation({
        label: 'New',
        type: 'text',
        region: { x: 0, y: 0, width: 100, height: 100 },
        startMs: 100,
        durationMs: 500,
        reveal: { direction: 'top_to_bottom', style: '', maskPaddingPx: 22, protectedRegions: [] },
        handPath: { start: [0, 0], end: [0, 0], easing: 'linear' },
      })
    })

    expect(result.current.annotations).toContainEqual(newAnnotation)
  })

  it('handles errors', async () => {
    vi.mocked(client.api.get).mockResolvedValue({ ok: false, error: 'Not found' })

    const { result } = renderHook(() => useAnnotations('clip-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Not found')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/lib/editor/hooks/use-annotations.test.ts
```

Expected: FAIL (hook not implemented)

- [ ] **Step 3: Implement useAnnotations hook**

Create `lib/editor/hooks/use-annotations.ts`:

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/lib/editor/hooks/use-annotations.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/editor/hooks/use-annotations.ts tests/lib/editor/hooks/use-annotations.test.ts
git commit -m "feat: implement useAnnotations hook"
```

---

## Phase 5: Frontend Components

### Task 8: Implement AnnotationsPanel Component

**Files:**
- Create: `lib/editor/components/annotations-panel.tsx`
- Create: `tests/lib/editor/components/annotations-panel.test.tsx`

**Interfaces:**
- Consumes: `useAnnotations()` hook, `TimelineClip` type, `getAbsoluteAnnotationTime()` utility
- Produces: React component `<AnnotationsPanel selectedClip={clip} />`

**Steps:**

- [ ] **Step 1: Write test for AnnotationsPanel component**

Create `tests/lib/editor/components/annotations-panel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AnnotationsPanel } from '@/lib/editor/components/annotations-panel'
import type { TimelineClip } from '@/lib/editor/types'

vi.mock('@/lib/editor/hooks/use-annotations')

describe('AnnotationsPanel', () => {
  const mockClip: TimelineClip = {
    id: 'clip-1',
    mediaId: 'media-1',
    trackId: 'v1',
    start: 5.0,
    duration: 11.7,
    offset: 0,
    speed: 1,
    volume: 1,
  }

  it('displays "Select a clip" when no clip selected', () => {
    render(<AnnotationsPanel selectedClip={null} />)
    expect(screen.getByText(/select a clip/i)).toBeInTheDocument()
  })

  it('displays annotations for selected clip', async () => {
    const useAnnotationsMock = vi.mocked(useAnnotations)
    useAnnotationsMock.mockReturnValue({
      annotations: [
        {
          id: 'ann-1',
          clipId: 'clip-1',
          label: 'Test Annotation',
          type: 'text',
          region: { x: 0, y: 0, width: 100, height: 100 },
          startMs: 300,
          durationMs: 1000,
          reveal: { direction: 'top_to_bottom', style: '', maskPaddingPx: 22, protectedRegions: [] },
          handPath: { start: [0, 0], end: [0, 0], easing: 'linear' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      isLoading: false,
      error: null,
      addAnnotation: vi.fn(),
      updateAnnotation: vi.fn(),
      deleteAnnotation: vi.fn(),
    })

    render(<AnnotationsPanel selectedClip={mockClip} />)

    expect(screen.getByText('Test Annotation')).toBeInTheDocument()
    expect(screen.getByText(/0:00:05\.300/)).toBeInTheDocument() // Absolute time
  })

  it('shows loading state', () => {
    const useAnnotationsMock = vi.mocked(useAnnotations)
    useAnnotationsMock.mockReturnValue({
      annotations: [],
      isLoading: true,
      error: null,
      addAnnotation: vi.fn(),
      updateAnnotation: vi.fn(),
      deleteAnnotation: vi.fn(),
    })

    render(<AnnotationsPanel selectedClip={mockClip} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('calls deleteAnnotation on delete button click', async () => {
    const mockDelete = vi.fn()
    const useAnnotationsMock = vi.mocked(useAnnotations)
    useAnnotationsMock.mockReturnValue({
      annotations: [
        {
          id: 'ann-1',
          clipId: 'clip-1',
          label: 'To Delete',
          type: 'text',
          region: { x: 0, y: 0, width: 100, height: 100 },
          startMs: 0,
          durationMs: 1000,
          reveal: { direction: 'top_to_bottom', style: '', maskPaddingPx: 22, protectedRegions: [] },
          handPath: { start: [0, 0], end: [0, 0], easing: 'linear' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      isLoading: false,
      error: null,
      addAnnotation: vi.fn(),
      updateAnnotation: vi.fn(),
      deleteAnnotation: mockDelete,
    })

    render(<AnnotationsPanel selectedClip={mockClip} />)

    const deleteButton = screen.getByRole('button', { name: /delete|trash/i })
    fireEvent.click(deleteButton)

    expect(mockDelete).toHaveBeenCalledWith('ann-1')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/lib/editor/components/annotations-panel.test.tsx
```

Expected: FAIL (component not implemented)

- [ ] **Step 3: Implement AnnotationsPanel component**

Create `lib/editor/components/annotations-panel.tsx`:

```typescript
'use client'

import React from 'react'
import type { TimelineClip } from '../types'
import { useAnnotations } from '../hooks/use-annotations'
import { formatTime, getAbsoluteAnnotationTime } from '@/lib/utils/time'
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
  const { annotations, isLoading, deleteAnnotation } =
    useAnnotations(selectedClip?.id ?? null)

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
          const absStart = getAbsoluteAnnotationTime(selectedClip, annotation.startMs)
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/lib/editor/components/annotations-panel.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/editor/components/annotations-panel.tsx tests/lib/editor/components/annotations-panel.test.tsx
git commit -m "feat: implement AnnotationsPanel component"
```

---

## Phase 6: Integration

### Task 9: Integrate Annotations into Editor Page

**Files:**
- Modify: `app/(protected)/editor/page.tsx`

**Interfaces:**
- Consumes: `useTimelineState()`, `AnnotationsPanel` component
- Produces: Editor page with `selectedClipId` state, wired to panel

**Steps:**

- [ ] **Step 1: Add selectedClipId state**

Open `app/(protected)/editor/page.tsx` and update the component:

```typescript
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

      <div className="w-80 border-l bg-background overflow-y-auto">
        <AnnotationsPanel selectedClip={selectedClip} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Ensure TimelineView emits onSelectClip**

Check `lib/editor/components/timeline.tsx` or equivalent to ensure:
- `TimelineClip` component is clickable
- Clicking a clip calls `onSelectClip(clipId)`
- Component accepts `onSelectClip` prop

If not already implemented, add to `TimelineClip` component:

```typescript
onClick={() => onSelectClip(id)}
className={selectedClipIds.includes(id) ? 'ring-2 ring-blue-500' : ''}
```

- [ ] **Step 3: Test in browser**

```bash
npm run dev
```

1. Navigate to editor page
2. Click on a clip in the timeline
3. Verify annotations panel loads and displays (should show "No annotations yet")
4. Clip should have visual selection indicator

- [ ] **Step 4: Commit**

```bash
git add app/\(protected\)/editor/page.tsx
git commit -m "feat: integrate annotations panel into editor"
```

---

### Task 10: Add Annotation Creation Form (Optional Polish)

**Files:**
- Create: `lib/editor/components/annotation-form.tsx`
- Modify: `lib/editor/components/annotations-panel.tsx`

**Interfaces:**
- Consumes: `useAnnotations()`, `TimelineClip` type
- Produces: Modal/form for creating annotations

**Steps:**

- [ ] **Step 1: Create annotation form component**

Create `lib/editor/components/annotation-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { TimelineClip, Annotation } from '../types'
import { CreateAnnotationSchema } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AnnotationFormProps {
  clip: TimelineClip
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Omit<Annotation, 'id' | 'clipId' | 'createdAt' | 'updatedAt'>) => Promise<void>
  isSubmitting?: boolean
}

export function AnnotationForm({
  clip,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: AnnotationFormProps) {
  const [formData, setFormData] = useState({
    label: '',
    type: 'text' as const,
    startMs: 0,
    durationMs: 1000,
    region: { x: 0, y: 0, width: 100, height: 100 },
    reveal: {
      direction: 'top_to_bottom' as const,
      style: '' as const,
      maskPaddingPx: 22,
      protectedRegions: [],
    },
    handPath: {
      start: [0, 0] as [number, number],
      end: [100, 100] as [number, number],
      easing: 'easeInOut' as const,
    },
    narrativeRole: '',
    sequence: 1,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onSubmit({
        ...formData,
        narrativeRole: formData.narrativeRole || undefined,
      })
      setFormData({
        label: '',
        type: 'text',
        startMs: 0,
        durationMs: 1000,
        region: { x: 0, y: 0, width: 100, height: 100 },
        reveal: {
          direction: 'top_to_bottom',
          style: '',
          maskPaddingPx: 22,
          protectedRegions: [],
        },
        handPath: {
          start: [0, 0],
          end: [100, 100],
          easing: 'easeInOut',
        },
        narrativeRole: '',
        sequence: 1,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to create annotation', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Annotation to {clip.id}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={formData.label}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, label: e.target.value }))
              }
              placeholder="e.g., 'Sac à main'"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as any }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="object">Object</SelectItem>
                <SelectItem value="prop">Prop</SelectItem>
                <SelectItem value="symbol">Symbol</SelectItem>
                <SelectItem value="structure">Structure</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startMs">Start (ms)</Label>
              <Input
                id="startMs"
                type="number"
                min="0"
                value={formData.startMs}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, startMs: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="durationMs">Duration (ms)</Label>
              <Input
                id="durationMs"
                type="number"
                min="1"
                value={formData.durationMs}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, durationMs: parseInt(e.target.value) || 1000 }))
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="narrativeRole">Narrative Role (optional)</Label>
            <Input
              id="narrativeRole"
              value={formData.narrativeRole}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, narrativeRole: e.target.value }))
              }
              placeholder="e.g., 'Main element'"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Update AnnotationsPanel to use form**

In `lib/editor/components/annotations-panel.tsx`, update:

```typescript
'use client'

import React, { useState } from 'react'
import type { TimelineClip } from '../types'
import { useAnnotations } from '../hooks/use-annotations'
import { AnnotationForm } from './annotation-form'
import { formatTime, getAbsoluteAnnotationTime } from '@/lib/utils/time'
import { Button } from '@/components/ui/button'
import { Trash2, Plus } from 'lucide-react'

interface AnnotationsPanelProps {
  selectedClip: TimelineClip | null
}

export function AnnotationsPanel({ selectedClip }: AnnotationsPanelProps) {
  const { annotations, isLoading, addAnnotation, deleteAnnotation } =
    useAnnotations(selectedClip?.id ?? null)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddAnnotation = async (data: any) => {
    setIsSubmitting(true)
    try {
      await addAnnotation(data)
    } finally {
      setIsSubmitting(false)
    }
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
          onClick={() => setShowForm(true)}
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
          const absStart = getAbsoluteAnnotationTime(selectedClip, annotation.startMs)
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

      {selectedClip && (
        <AnnotationForm
          clip={selectedClip}
          open={showForm}
          onOpenChange={setShowForm}
          onSubmit={handleAddAnnotation}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Test in browser**

```bash
npm run dev
```

1. Select a clip
2. Click "Add" button
3. Fill form and submit
4. Verify annotation appears in list

- [ ] **Step 4: Commit**

```bash
git add lib/editor/components/annotation-form.tsx lib/editor/components/annotations-panel.tsx
git commit -m "feat: add annotation creation form"
```

---

## Phase 7: Optional - Python Integration

### Task 11: Admin Endpoint for Annotation Import (Optional)

**Files:**
- Create: `app/api/admin/annotations/import/route.ts`

**Interfaces:**
- Consumes: Python JSON from request body
- Produces: Imports annotations into DB

**Steps:**

- [ ] **Step 1: Implement admin import endpoint**

Create `app/api/admin/annotations/import/route.ts`:

```typescript
import { db } from '@/lib/database'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // TODO: Add auth check (admin only)
    // const session = await auth.getSession()
    // if (!session || session.user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const body = await request.json()
    const { clipId, annotationJson } = body

    // Verify clip exists
    const clip = await db.timelineClip.findUnique({
      where: { id: clipId },
    })
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
    await db.annotation.createMany({
      data: annotations,
    })

    return NextResponse.json({
      success: true,
      imported: annotations.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/annotations/import/route.ts
git commit -m "feat: add admin annotation import endpoint"
```

---

### Task 12: CLI Script for Batch Import (Optional)

**Files:**
- Create: `scripts/import-annotations.ts`

**Steps:**

- [ ] **Step 1: Create CLI script**

Create `scripts/import-annotations.ts`:

```typescript
import fs from 'fs'
import path from 'path'
import { db } from '@/lib/database'

async function importAnnotations(annotationsDir: string) {
  if (!fs.existsSync(annotationsDir)) {
    console.error(`Directory not found: ${annotationsDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(annotationsDir)
  let imported = 0

  for (const file of files) {
    if (!file.startsWith('clip-') || !file.endsWith('.json')) continue

    const clipId = file.replace('clip-', '').replace('.json', '')
    const jsonPath = path.join(annotationsDir, file)

    console.log(`Importing ${file} (clipId: ${clipId})...`)

    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

      // Normalize
      const annotations = data.elements.map((el: any) => ({
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

      // Create in DB
      await db.annotation.createMany({ data: annotations })
      imported += annotations.length
      console.log(`  ✓ Imported ${annotations.length} annotations`)
    } catch (error) {
      console.error(`  ✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  console.log(`\nImport complete! Total: ${imported} annotations`)
}

// Usage: npx ts-node scripts/import-annotations.ts ./annotations
const dir = process.argv[2] || './annotations'
importAnnotations(dir).catch(console.error).finally(() => process.exit(0))
```

- [ ] **Step 2: Commit**

```bash
git add scripts/import-annotations.ts
git commit -m "feat: add CLI script for batch annotation import"
```

---

## Verification Checklist

Before considering this complete:

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No TS errors: `npm run lint`
- [ ] Dev server runs: `npm run dev`
- [ ] Editor page loads with clip selection
- [ ] AnnotationsPanel shows on clip selection
- [ ] Annotations can be created, viewed, and deleted
- [ ] Timecodes display correctly (absolute format)
- [ ] Moving a clip updates annotation timecodes

---

## Summary

This plan implements a complete clip annotation system:

**Phase 1:** Prisma schema + TypeScript types (Tasks 1-2)  
**Phase 2:** Time utilities (Task 3)  
**Phase 3:** API routes for CRUD (Tasks 4-6)  
**Phase 4:** Frontend hook (Task 7)  
**Phase 5:** Frontend components (Task 8)  
**Phase 6:** Integration into editor (Tasks 9-10)  
**Phase 7:** Optional Python import (Tasks 11-12)

Each task is independently testable and commits cleanly. Follow TDD, run tests after each task, and commit frequently.

