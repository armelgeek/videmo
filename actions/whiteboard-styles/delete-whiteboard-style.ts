'use server'

import { db as prisma } from '@/lib/db'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'

export interface DeleteWhiteboardStyleResponse {
  success: boolean
  error?: string
}

/**
 * Retires a style the organization wrote.
 *
 * Soft delete, because projects store the key. Scoped to the organization, so
 * the shipped styles cannot be removed — deleting an override simply brings the
 * shipped one back.
 */
export async function deleteWhiteboardStyle(id: string): Promise<DeleteWhiteboardStyleResponse> {
  try {
    const viewer = await requireSessionViewer()
    if (!viewer.organizationId) return { success: false, error: 'Unauthorized' }

    const { count } = await prisma.whiteboardStyle.updateMany({
      where: { id, organizationId: viewer.organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    return count === 0 ? { success: false, error: 'Style not found' } : { success: true }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return { success: false, error: 'Unauthorized' }
    console.error('Deleting a whiteboard style failed:', error)
    return { success: false, error: 'Failed to delete the whiteboard style' }
  }
}
