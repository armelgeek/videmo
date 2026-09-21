'use server'

import { db as prisma } from '@/lib/db'
import { listFormatsFor } from '@/lib/storyboard/formats/repository'
import { LIBRARY_FORBIDDEN, viewerCanCurate } from '@/lib/storyboard/library-access'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'

export interface SetDefaultFormatResponse {
  success: boolean
  error?: string
}

/**
 * Picks the format new projects start on for this organization.
 *
 * `null` gives the choice back to the format shipped as the product default.
 * The key is checked against what the organization can actually see, so a
 * default can never point at another organization's format.
 */
export async function setDefaultFormat(key: string | null): Promise<SetDefaultFormatResponse> {
  try {
    const viewer = await requireSessionViewer()
    if (!viewer.organizationId) return { success: false, error: 'Unauthorized' }
    if (!(await viewerCanCurate(viewer.organizationId, viewer.userId))) {
      return { success: false, error: LIBRARY_FORBIDDEN }
    }

    if (key !== null) {
      const formats = await listFormatsFor(viewer.organizationId)
      if (!formats.some((format) => format.id === key)) {
        return { success: false, error: 'Unknown format' }
      }
    }

    await prisma.organization.update({
      where: { id: viewer.organizationId },
      data: { defaultFormatKey: key },
    })

    return { success: true }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return { success: false, error: 'Unauthorized' }
    console.error('Setting the default video format failed:', error)
    return { success: false, error: 'Failed to set the default format' }
  }
}
