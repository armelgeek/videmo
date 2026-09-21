'use server'

import { z } from 'zod'
import { db as prisma } from '@/lib/db'
import { visualStyleInputSchema } from '@/lib/storyboard/visual-styles/schema'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'
import { LIBRARY_FORBIDDEN, viewerCanCurate } from '@/lib/storyboard/library-access'

export interface SaveVisualStyleResponse {
  success: boolean
  data?: { id: string; key: string }
  error?: string
}

/**
 * Creates or updates a style belonging to the caller's organization.
 *
 * The shipped styles are never written to: saving under the key of a shipped
 * one creates the organization's OWN row with that key, which then wins at
 * resolution while the original stays intact for everyone else.
 */
export async function saveVisualStyle(input: unknown): Promise<SaveVisualStyleResponse> {
  try {
    const viewer = await requireSessionViewer()
    if (!viewer.organizationId) {
      return { success: false, error: 'Select an organization before writing a style' }
    }

    if (!(await viewerCanCurate(viewer.organizationId, viewer.userId))) {
      return { success: false, error: LIBRARY_FORBIDDEN }
    }

    const data = visualStyleInputSchema.parse(input)
    const organizationId = viewer.organizationId

    const existing = await prisma.visualStyle.findFirst({
      where: { key: data.key, organizationId },
      select: { id: true },
    })

    const row = {
      key: data.key,
      label: data.label,
      hint: data.hint,
      artDirection: data.artDirection,
      accentColors: data.accentColors,
      vocabulary: data.vocabulary,
      labels: data.labels,
    }

    const saved = existing
      ? await prisma.visualStyle.update({
          where: { id: existing.id },
          data: { ...row, deletedAt: null },
          select: { id: true, key: true },
        })
      : await prisma.visualStyle.create({
          data: { ...row, organizationId, isBuiltIn: false },
          select: { id: true, key: true },
        })

    return { success: true, data: saved }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return { success: false, error: 'Unauthorized' }
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Invalid style' }
    }
    console.error('Saving a visual style failed:', error)
    return { success: false, error: 'Failed to save the visual style' }
  }
}
