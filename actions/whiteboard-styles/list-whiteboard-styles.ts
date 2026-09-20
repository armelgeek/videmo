'use server'

import {
  listManagedWhiteboardStylesFor,
  listWhiteboardStylesFor,
} from '@/lib/storyboard/whiteboard-styles/repository'
import type { ManagedWhiteboardStyle, WhiteboardStyle } from '@/lib/storyboard/whiteboard-styles/types'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'

export interface ListWhiteboardStylesResponse {
  success: boolean
  data?: WhiteboardStyle[]
  error?: string
}

export interface ListManagedWhiteboardStylesResponse {
  success: boolean
  data?: ManagedWhiteboardStyle[]
  /** False when no organization is active: nothing can be written yet. */
  canWrite?: boolean
  error?: string
}

/** The styles the picker offers: the shipped ones and the organization's own. */
export async function listWhiteboardStyles(): Promise<ListWhiteboardStylesResponse> {
  try {
    const viewer = await requireSessionViewer()
    return { success: true, data: await listWhiteboardStylesFor(viewer.organizationId) }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return { success: false, error: 'Unauthorized' }
    console.error('Listing whiteboard styles failed:', error)
    return { success: false, error: 'Failed to load whiteboard styles' }
  }
}

/** The same styles with what the management screen needs to act on each. */
export async function listManagedWhiteboardStyles(): Promise<ListManagedWhiteboardStylesResponse> {
  try {
    const viewer = await requireSessionViewer()
    return {
      success: true,
      canWrite: viewer.organizationId !== null,
      data: await listManagedWhiteboardStylesFor(viewer.organizationId),
    }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return { success: false, error: 'Unauthorized' }
    console.error('Listing managed whiteboard styles failed:', error)
    return { success: false, error: 'Failed to load whiteboard styles' }
  }
}
