'use server'

import { defaultFormatKeyFor, listFormatsFor } from '@/lib/storyboard/formats/repository'
import type { VideoFormat } from '@/lib/storyboard/formats'
import { ProjectUnauthorizedError, requireSessionViewer } from '@/lib/video-project/session'

export interface ListVideoFormatsResponse {
  success: boolean
  data?: VideoFormat[]
  /** The format a new project should start on, when the organization set one. */
  defaultKey?: string | null
  error?: string
}

/** Every format this organization can write against: the shipped ones and its own. */
export async function listVideoFormats(): Promise<ListVideoFormatsResponse> {
  try {
    const viewer = await requireSessionViewer()
    return {
      success: true,
      data: await listFormatsFor(viewer.organizationId),
      defaultKey: await defaultFormatKeyFor(viewer.organizationId),
    }
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) {
      return { success: false, error: 'Unauthorized' }
    }
    console.error('Listing video formats failed:', error)
    return { success: false, error: 'Failed to load video formats' }
  }
}
