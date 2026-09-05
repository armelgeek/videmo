import { prisma } from '@/lib/prisma'
import { CreateAnnotationSchema } from '@/lib/editor/types'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  try {
    const { clipId } = await params

    const viewer = await requireViewer();
    const clip = await prisma.timelineClip.findUnique({
      where: { id: clipId },
      select: { videoProjectId: true },
    });
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }
    await requireProjectAccess(clip.videoProjectId, viewer, "read");

    // Fetch annotations ordered by sequence
    const annotations = await prisma.annotation.findMany({
      where: { clipId },
      orderBy: { sequence: 'asc' },
    })

    return NextResponse.json(annotations)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  try {
    const { clipId } = await params
    const body = await request.json()

    const viewer = await requireViewer();
    const clip = await prisma.timelineClip.findUnique({
      where: { id: clipId },
      select: { videoProjectId: true },
    });
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }
    await requireProjectAccess(clip.videoProjectId, viewer, "update");

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
    return toErrorResponse(error)
  }
}
