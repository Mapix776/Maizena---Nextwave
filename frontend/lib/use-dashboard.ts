'use client'

import { useCallback, useEffect, useState } from 'react'
import type { JsonRenderSpec } from '@/lib/json-render/catalog'
import { getBackendUrl } from '@/lib/backend-url'

export type DashboardItemKind =
  | 'full_spec'
  | 'chart'
  | 'table'
  | 'decision'
  | 'metrics'
  | 'alert_list'
  | 'route_map'
  | 'timeline'
  | 'card'

export type DashboardSize = 'small' | 'medium' | 'large'

export type SaveDashboardInput = {
  title: string
  kind: DashboardItemKind
  payload: JsonRenderSpec
  subtitle?: string
}

export interface DashboardItem extends SaveDashboardInput {
  id: string
  order: number
  size: DashboardSize
  createdAt: string
}

const STORAGE_KEY = 'route-pilot-dashboards-v1'
const LEGACY_SAVED_KEY = 'route-pilot-saved-cards'
const MIGRATION_FLAG = 'route-pilot-dashboards-migrated-v1'
const SYNC_EVENT = 'route-pilot:dashboards-sync'

function defaultSizeFor(kind: DashboardItemKind): DashboardSize {
  if (kind === 'full_spec') return 'large'
  if (kind === 'metrics' || kind === 'alert_list' || kind === 'route_map' || kind === 'table') return 'medium'
  return 'small'
}

function makeId(): string {
  return `dash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function readStorage(): DashboardItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DashboardItem[]) : []
  } catch {
    return []
  }
}

// One-time import of anything the user had in the previous "Saved" store so the
// unified Dashboards board starts populated instead of empty.
function migrateLegacy(existing: DashboardItem[]): DashboardItem[] {
  if (typeof window === 'undefined') return existing
  try {
    if (window.localStorage.getItem(MIGRATION_FLAG)) return existing
    const raw = window.localStorage.getItem(LEGACY_SAVED_KEY)
    window.localStorage.setItem(MIGRATION_FLAG, '1')
    if (!raw) return existing
    const parsed = JSON.parse(raw) as Array<{ id: string; title: string; savedAt?: number; spec: JsonRenderSpec }>
    if (!Array.isArray(parsed) || parsed.length === 0) return existing
    const migrated: DashboardItem[] = parsed.map((item, index) => ({
      id: item.id || makeId(),
      title: item.title || 'Saved result',
      subtitle: 'Full result',
      kind: 'full_spec',
      payload: item.spec,
      size: 'large',
      order: existing.length + index,
      createdAt: new Date(item.savedAt ?? Date.now()).toISOString(),
    }))
    return [...existing, ...migrated]
  } catch {
    return existing
  }
}

// Best-effort backend sync. The dashboards endpoints may not exist yet, so every
// call swallows failures — localStorage remains the source of truth meanwhile.
function syncToBackend(action: string, payload: unknown) {
  if (typeof window === 'undefined') return
  try {
    void fetch(`${getBackendUrl()}/api/dashboards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    }).catch(() => {})
  } catch {
    // Ignore — offline or endpoint absent.
  }
}

/**
 * Unified client store for the Dashboards workspace. Holds saved chat results and
 * their individual components (charts, tables, decisions, metrics...) in a single
 * localStorage-backed list, mirrored best-effort to the backend and kept in sync
 * across component instances in the same tab.
 */
export function useDashboard() {
  const [items, setItems] = useState<DashboardItem[]>([])

  useEffect(() => {
    setItems(migrateLegacy(readStorage()))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Best-effort persistence.
    }
  }, [items])

  // Keep every hook instance (chat + dashboard view) consistent within the tab.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: Event) => {
      const next = (event as CustomEvent<DashboardItem[]>).detail
      if (Array.isArray(next)) setItems(next)
    }
    window.addEventListener(SYNC_EVENT, handler as EventListener)
    return () => window.removeEventListener(SYNC_EVENT, handler as EventListener)
  }, [])

  const broadcast = useCallback((next: DashboardItem[]) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: next }))
  }, [])

  const isSaved = useCallback(
    (title: string, kind?: DashboardItemKind) =>
      items.some((item) => item.title === title && (kind === undefined || item.kind === kind)),
    [items],
  )

  // Toggle: save the component if absent, remove it if already saved. Returns the
  // resulting saved state so callers can show the right toast.
  const toggleItem = useCallback(
    (input: SaveDashboardInput) => {
      let nowSaved = false
      setItems((current) => {
        const existingIndex = current.findIndex(
          (item) => item.title === input.title && item.kind === input.kind,
        )
        let next: DashboardItem[]
        if (existingIndex >= 0) {
          next = current.filter((_, index) => index !== existingIndex)
          syncToBackend('remove', { title: input.title, kind: input.kind })
        } else {
          nowSaved = true
          const item: DashboardItem = {
            ...input,
            id: makeId(),
            size: defaultSizeFor(input.kind),
            order: current.length,
            createdAt: new Date().toISOString(),
          }
          next = [...current, item]
          syncToBackend('add', item)
        }
        broadcast(next)
        return next
      })
      return nowSaved
    },
    [broadcast],
  )

  const deleteItem = useCallback(
    (id: string) => {
      setItems((current) => {
        const next = current.filter((item) => item.id !== id)
        broadcast(next)
        syncToBackend('remove', { id })
        return next
      })
    },
    [broadcast],
  )

  const resizeItem = useCallback(
    (id: string, size: DashboardSize) => {
      setItems((current) => {
        const next = current.map((item) => (item.id === id ? { ...item, size } : item))
        broadcast(next)
        syncToBackend('resize', { id, size })
        return next
      })
    },
    [broadcast],
  )

  return { items, isSaved, toggleItem, deleteItem, resizeItem }
}
