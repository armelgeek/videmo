'use server'

import { listManagedFormatsFor } from '@/lib/storyboard/formats/repository'
import type { ManagedFormat } from '@/lib/storyboard/formats'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'
import { viewerCanCurate } from '@/lib/storyboard/library-access'

export interface ListManagedFormatsResponse {
  success: boolean
  data?: ManagedFormat[]
  /** False unless the viewer is an owner or admin of an active organization. */
  canWrite?: boolean
  error?: string
}

/**
 * The formats, with what the management screen needs to act on each one.
 *
 * Separate from `listVideoFormats`, which feeds the picker and has no business
 * knowing which rows happen to be editable.
 */
export async function listManagedFormats(): Promise<ListManagedFormatsResponse> {
  try {
    const viewer = await requireSessionViewer()
    return {
      success: true,
      canWrite: await viewerCanCurate(viewer.organizationId, viewer.userId),
      data: await listManagedFormatsFor(viewer.organizationId),
    }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) {
      return { success: false, error: 'Unauthorized' }
    }
    console.error('Listing managed video formats failed:', error)
    return { success: false, error: 'Failed to load video formats' }
  }
}
