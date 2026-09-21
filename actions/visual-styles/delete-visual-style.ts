'use server'

import { db as prisma } from '@/lib/db'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'
import { LIBRARY_FORBIDDEN, viewerCanCurate } from '@/lib/storyboard/library-access'

export interface DeleteVisualStyleResponse {
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
export async function deleteVisualStyle(id: string): Promise<DeleteVisualStyleResponse> {
  try {
    const viewer = await requireSessionViewer()
    if (!viewer.organizationId) return { success: false, error: 'Unauthorized' }
    if (!(await viewerCanCurate(viewer.organizationId, viewer.userId))) {
      return { success: false, error: LIBRARY_FORBIDDEN }
    }

    const { count } = await prisma.visualStyle.updateMany({
      where: { id, organizationId: viewer.organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    return count === 0 ? { success: false, error: 'Style not found' } : { success: true }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return { success: false, error: 'Unauthorized' }
    console.error('Deleting a visual style failed:', error)
    return { success: false, error: 'Failed to delete the visual style' }
  }
}
