'use server'

import { db as prisma } from '@/lib/db'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'

export interface DeleteVideoFormatResponse {
  success: boolean
  error?: string
}

/**
 * Retires a format the organization wrote.
 *
 * Soft delete, because projects store the key: a hard delete would leave them
 * pointing at nothing. Scoped to the organization, so the shipped formats
 * cannot be removed — deleting an override simply brings the shipped one back.
 */
export async function deleteVideoFormat(id: string): Promise<DeleteVideoFormatResponse> {
  try {
    const viewer = await requireSessionViewer()
    if (!viewer.organizationId) {
      return { success: false, error: 'Unauthorized' }
    }

    const { count } = await prisma.videoFormat.updateMany({
      where: { id, organizationId: viewer.organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    if (count === 0) {
      return { success: false, error: 'Format not found' }
    }

    return { success: true }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) {
      return { success: false, error: 'Unauthorized' }
    }
    console.error('Deleting a video format failed:', error)
    return { success: false, error: 'Failed to delete the video format' }
  }
}
