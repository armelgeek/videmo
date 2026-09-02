import { prisma } from '@/lib/prisma'
import { UpdateAnnotationSchema } from '@/lib/editor/types'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clipId: string; annotationId: string }> }
) {
  try {
    const { clipId, annotationId } = await params
    const body = await request.json()

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clipId: string; annotationId: string }> }
) {
  try {
    const { clipId, annotationId } = await params

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete' },
      { status: 500 }
    )
  }
}
