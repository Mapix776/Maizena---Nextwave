'use client'

import { useCallback, useEffect, useState } from 'react'
import type { JsonRenderSpec } from '@/lib/json-render/catalog'

export interface SavedSpec {
  id: string
  title: string
  savedAt: number
  spec: JsonRenderSpec
}

const STORAGE_KEY = 'route-pilot-saved-cards'

function readStorage(): SavedSpec[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedSpec[]) : []
  } catch {
    return []
  }
}

/**
 * Client-side bookmarking store for json-render specs generated in the chat.
 * Kept in React state (shared from the App root) and mirrored to localStorage
 * so saved cards survive reloads. This is a UI convenience layer only; it never
 * mutates operational data or backend state.
 */
export function useSavedSpecs() {
  const [savedSpecs, setSavedSpecs] = useState<SavedSpec[]>([])

  useEffect(() => {
    setSavedSpecs(readStorage())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSpecs))
    } catch {
      // Ignore quota or serialization errors — bookmarking is best-effort.
    }
  }, [savedSpecs])

  const isSaved = useCallback(
    (id: string) => savedSpecs.some((item) => item.id === id),
    [savedSpecs],
  )

  const toggleSave = useCallback(
    (entry: { id: string; title: string; spec: JsonRenderSpec }) => {
      let nowSaved = false
      setSavedSpecs((current) => {
        if (current.some((item) => item.id === entry.id)) {
          return current.filter((item) => item.id !== entry.id)
        }
        nowSaved = true
        return [
          { id: entry.id, title: entry.title, savedAt: Date.now(), spec: entry.spec },
          ...current,
        ]
      })
      return nowSaved
    },
    [],
  )

  const removeSpec = useCallback((id: string) => {
    setSavedSpecs((current) => current.filter((item) => item.id !== id))
  }, [])

  return { savedSpecs, isSaved, toggleSave, removeSpec }
}
