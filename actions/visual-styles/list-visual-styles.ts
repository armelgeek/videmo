'use server'

import {
  defaultVisualStyleKeyFor,
  listManagedVisualStylesFor,
  listVisualStylesFor,
} from '@/lib/storyboard/visual-styles/repository'
import type { ManagedVisualStyle, VisualStyle } from '@/lib/storyboard/visual-styles/types'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'
import { viewerCanCurate } from '@/lib/storyboard/library-access'

export interface ListVisualStylesResponse {
  success: boolean
  data?: VisualStyle[]
  /** The style a new project should start on, when the organization set one. */
  defaultKey?: string | null
  error?: string
}

export interface ListManagedVisualStylesResponse {
  success: boolean
  data?: ManagedVisualStyle[]
  /** False unless the viewer is an owner or admin of an active organization. */
  canWrite?: boolean
  /** The style new projects start on, null while the product default stands. */
  defaultKey?: string | null
  error?: string
}

/** The styles the picker offers: the shipped ones and the organization's own. */
export async function listVisualStyles(): Promise<ListVisualStylesResponse> {
  try {
    const viewer = await requireSessionViewer()
    return {
      success: true,
      data: await listVisualStylesFor(viewer.organizationId),
      defaultKey: await defaultVisualStyleKeyFor(viewer.organizationId),
    }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return { success: false, error: 'Unauthorized' }
    console.error('Listing visual styles failed:', error)
    return { success: false, error: 'Failed to load visual styles' }
  }
}

/** The same styles with what the management screen needs to act on each. */
export async function listManagedVisualStyles(): Promise<ListManagedVisualStylesResponse> {
  try {
    const viewer = await requireSessionViewer()
    return {
      success: true,
      canWrite: await viewerCanCurate(viewer.organizationId, viewer.userId),
      defaultKey: await defaultVisualStyleKeyFor(viewer.organizationId),
      data: await listManagedVisualStylesFor(viewer.organizationId),
    }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return { success: false, error: 'Unauthorized' }
    console.error('Listing managed visual styles failed:', error)
    return { success: false, error: 'Failed to load visual styles' }
  }
}
