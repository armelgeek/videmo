'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Annotation } from '../types'
import { api } from '@/lib/client'

export function useAnnotations(clipId: string | null) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch annotations when clipId changes
  useEffect(() => {
    if (!clipId) {
      setAnnotations([])
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    api
      .get<Annotation[]>(`/api/clips/${clipId}/annotations`)
      .then((res) => {
        if (!res.ok) throw new Error(res.error)
        setAnnotations(res.data || [])
      })
      .catch((err) => {
        setError(err.message || 'Failed to load annotations')
      })
      .finally(() => setIsLoading(false))
  }, [clipId])

  // Add annotation
  const addAnnotation = useCallback(
    async (data: Omit<Annotation, 'id' | 'clipId' | 'createdAt' | 'updatedAt'>) => {
      if (!clipId) return

      try {
        const res = await api.post<Annotation>(`/api/clips/${clipId}/annotations`, data)
        if (!res.ok) throw new Error(res.error)
        setAnnotations((prev) => [...prev, res.data])
        return res.data
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add annotation')
        throw err
      }
    },
    [clipId]
  )

  // Update annotation
  const updateAnnotation = useCallback(
    async (annotationId: string, data: Partial<Annotation>) => {
      if (!clipId) return

      try {
        const res = await api.patch<Annotation>(
          `/api/clips/${clipId}/annotations/${annotationId}`,
          data
        )
        if (!res.ok) throw new Error(res.error)
        setAnnotations((prev) =>
          prev.map((a) => (a.id === annotationId ? res.data : a))
        )
        return res.data
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update annotation')
        throw err
      }
    },
    [clipId]
  )

  // Delete annotation
  const deleteAnnotation = useCallback(
    async (annotationId: string) => {
      if (!clipId) return

      try {
        const res = await api.delete<{ success: boolean }>(
          `/api/clips/${clipId}/annotations/${annotationId}`
        )
        if (!res.ok) throw new Error(res.error)
        setAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete annotation')
        throw err
      }
    },
    [clipId]
  )

  return {
    annotations,
    isLoading,
    error,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
  }
}
