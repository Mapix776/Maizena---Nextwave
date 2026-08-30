'use client'

import nextDynamic from 'next/dynamic'
import type { InteractiveRouteMapProps } from './interactive-route-map-types'

export type { InteractiveRouteMapProps } from './interactive-route-map-types'

// Leaflet touches `window` at import time, so the map canvas must never render
// on the server. Loading it with ssr:false keeps the json-render page prerenderable.
const RouteMapCanvas = nextDynamic(
  () => import('./interactive-route-map-canvas').then((m) => m.RouteMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="route-map-canvas route-map-loading" aria-hidden="true" />
    ),
  },
)

export function InteractiveRouteMap(props: InteractiveRouteMapProps) {
  return <RouteMapCanvas {...props} />
}
