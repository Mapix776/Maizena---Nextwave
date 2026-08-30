export type PaneTabNavigationKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'

export function keyboardPaneTabTarget(
  ids: readonly string[],
  selectedId: string | null,
  key: string,
): string | null {
  if (ids.length === 0) return null
  if (key === 'Home') return ids[0]
  if (key === 'End') return ids.at(-1) ?? null
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null

  const selectedIndex = Math.max(0, ids.indexOf(selectedId ?? ''))
  const direction = key === 'ArrowRight' ? 1 : -1
  return ids[(selectedIndex + direction + ids.length) % ids.length]
}

export function closePaneTabState(
  ids: readonly string[],
  selectedId: string | null,
  closingId: string,
) {
  const closingIndex = ids.indexOf(closingId)
  if (closingIndex < 0) {
    return { remainingIds: [...ids], selectedId }
  }

  const remainingIds = ids.filter((id) => id !== closingId)
  if (selectedId !== closingId) return { remainingIds, selectedId }

  return {
    remainingIds,
    selectedId:
      remainingIds[Math.min(closingIndex, remainingIds.length - 1)] ?? null,
  }
}
