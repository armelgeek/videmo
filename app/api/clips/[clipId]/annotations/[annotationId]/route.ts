import { prisma } from '@/lib/prisma'
import { UpdateAnnotationSchema } from '@/lib/editor/types'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clipId: string; annotationId: string }> }
) {
  try {
    const { clipId, annotationId } = await params
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

    // Verify annotation belongs to clip
    const annotation = await prisma.annotation.findUnique({
      where: { id: annotationId },
    })
    if (!annotation || annotation.clipId !== clipId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Validate input (partial)
    const validated = UpdateAnnotationSchema.parse(body)

    // Update
    const updated = await prisma.annotation.update({
      where: { id: annotationId },
      data: validated,
    })

    return NextResponse.json(updated)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clipId: string; annotationId: string }> }
) {
  try {
    const { clipId, annotationId } = await params

    const viewer = await requireViewer();
    const clip = await prisma.timelineClip.findUnique({
      where: { id: clipId },
      select: { videoProjectId: true },
    });
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }
    await requireProjectAccess(clip.videoProjectId, viewer, "update");

    // Verify annotation belongs to clip
    const annotation = await prisma.annotation.findUnique({
      where: { id: annotationId },
    })
    if (!annotation || annotation.clipId !== clipId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Delete
    await prisma.annotation.delete({
      where: { id: annotationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
