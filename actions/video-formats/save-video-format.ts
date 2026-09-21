'use server'

import { z } from 'zod'
import { db as prisma } from '@/lib/db'
import { videoFormatInputSchema } from '@/lib/storyboard/formats/schema'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'
import { LIBRARY_FORBIDDEN, viewerCanCurate } from '@/lib/storyboard/library-access'

export interface SaveVideoFormatResponse {
  success: boolean
  data?: { id: string; key: string }
  error?: string
}

/**
 * Creates or updates a format belonging to the caller's organization.
 *
 * The shipped formats are never written to: saving under the key of a shipped
 * one creates the organization's OWN row with that key, which then wins at
 * resolution. That is how a format is overridden without a deploy, and how the
 * original stays intact for everyone else.
 */
export async function saveVideoFormat(input: unknown): Promise<SaveVideoFormatResponse> {
  try {
    const viewer = await requireSessionViewer()
    if (!viewer.organizationId) {
      return { success: false, error: 'Select an organization before writing a format' }
    }

    if (!(await viewerCanCurate(viewer.organizationId, viewer.userId))) {
      return { success: false, error: LIBRARY_FORBIDDEN }
    }

    const data = videoFormatInputSchema.parse(input)
    const organizationId = viewer.organizationId

    const existing = await prisma.videoFormat.findFirst({
      where: { key: data.key, organizationId },
      select: { id: true },
    })

    const row = {
      key: data.key,
      label: data.label,
      hint: data.hint,
      thumbnailUrl: data.thumbnailUrl,
      paragraphs: data.paragraphs,
      structure: data.structure,
      defaultTone: data.defaultTone,
      breakdownRules: data.breakdownRules,
      usesCharacter: data.usesCharacter,
    }

    const saved = existing
      ? await prisma.videoFormat.update({
          where: { id: existing.id },
          data: { ...row, deletedAt: null },
          select: { id: true, key: true },
        })
      : await prisma.videoFormat.create({
          data: { ...row, organizationId, isBuiltIn: false },
          select: { id: true, key: true },
        })

    return { success: true, data: saved }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) {
      return { success: false, error: 'Unauthorized' }
    }
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Invalid format' }
    }
    console.error('Saving a video format failed:', error)
    return { success: false, error: 'Failed to save the video format' }
  }
}
