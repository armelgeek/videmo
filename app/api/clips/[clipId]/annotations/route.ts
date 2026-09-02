import { prisma } from '@/lib/prisma'
import { CreateAnnotationSchema } from '@/lib/editor/types'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  try {
    const { clipId } = await params

    // Verify clip exists
    const clip = await prisma.timelineClip.findUnique({
      where: { id: clipId },
    })
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    // Fetch annotations ordered by sequence
    const annotations = await prisma.annotation.findMany({
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  try {
    const { clipId } = await params
    const body = await request.json()

    // Verify clip exists
    const clip = await prisma.timelineClip.findUnique({
      where: { id: clipId },
    })
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    // Validate input
    const validated = CreateAnnotationSchema.parse(body)

    // Create annotation
    const annotation = await prisma.annotation.create({
      data: {
        ...validated,
        clipId,
      },
    })

    return NextResponse.json(annotation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create' },
      { status: 500 }
    )
  }
}
