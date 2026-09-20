'use server'

import { z } from 'zod'
import { db as prisma } from '@/lib/db'
import { whiteboardStyleInputSchema } from '@/lib/storyboard/whiteboard-styles/schema'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'

export interface SaveWhiteboardStyleResponse {
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
export async function saveWhiteboardStyle(input: unknown): Promise<SaveWhiteboardStyleResponse> {
  try {
    const viewer = await requireSessionViewer()
    if (!viewer.organizationId) {
      return { success: false, error: 'Select an organization before writing a style' }
    }

    const data = whiteboardStyleInputSchema.parse(input)
    const organizationId = viewer.organizationId

    const existing = await prisma.whiteboardStyle.findFirst({
      where: { key: data.key, organizationId },
      select: { id: true },
    })

    const row = {
      key: data.key,
      label: data.label,
      hint: data.hint,
      animStyle: data.animStyle,
      handStyle: data.handStyle,
    }

    const saved = existing
      ? await prisma.whiteboardStyle.update({
          where: { id: existing.id },
          data: { ...row, deletedAt: null },
          select: { id: true, key: true },
        })
      : await prisma.whiteboardStyle.create({
          data: { ...row, organizationId, isBuiltIn: false },
          select: { id: true, key: true },
        })

    return { success: true, data: saved }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return { success: false, error: 'Unauthorized' }
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Invalid style' }
    }
    console.error('Saving a whiteboard style failed:', error)
    return { success: false, error: 'Failed to save the whiteboard style' }
  }
}
