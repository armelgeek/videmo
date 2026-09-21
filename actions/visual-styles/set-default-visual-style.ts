'use server'

import { db as prisma } from '@/lib/db'
import { listVisualStylesFor } from '@/lib/storyboard/visual-styles/repository'
import { LIBRARY_FORBIDDEN, viewerCanCurate } from '@/lib/storyboard/library-access'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'

export interface SetDefaultVisualStyleResponse {
  success: boolean
  error?: string
}

/**
 * Picks the style new projects are drawn in for this organization.
 *
 * `null` gives the choice back to the style shipped as the product default.
 * The key is checked against what the organization can actually see, so a
 * default can never point at another organization's style.
 */
export async function setDefaultVisualStyle(key: string | null): Promise<SetDefaultVisualStyleResponse> {
  try {
    const viewer = await requireSessionViewer()
    if (!viewer.organizationId) return { success: false, error: 'Unauthorized' }
    if (!(await viewerCanCurate(viewer.organizationId, viewer.userId))) {
      return { success: false, error: LIBRARY_FORBIDDEN }
    }

    if (key !== null) {
      const styles = await listVisualStylesFor(viewer.organizationId)
      if (!styles.some((style) => style.id === key)) {
        return { success: false, error: 'Unknown visual style' }
      }
    }

    await prisma.organization.update({
      where: { id: viewer.organizationId },
      data: { defaultVisualStyleKey: key },
    })

    return { success: true }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return { success: false, error: 'Unauthorized' }
    console.error('Setting the default visual style failed:', error)
    return { success: false, error: 'Failed to set the default style' }
  }
}
