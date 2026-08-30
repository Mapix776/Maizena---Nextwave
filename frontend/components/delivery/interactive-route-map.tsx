'use client'

import { useEffect, useMemo, useState } from 'react'
import { divIcon, latLngBounds } from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { Anchor, Plane, Ship, Truck } from 'lucide-react'

type Point = { name: string; lat: number; lng: number; vessel?: string }
type Waypoint = { name: string; lat: number; lng: number; status: 'completed' | 'current' | 'pending' }

export interface InteractiveRouteMapProps {
  title: string
  operationReference?: string
  originPort: { name: string; lat: number; lng: number }
  destinationPort: { name: string; lat: number; lng: number }
  currentPosition?: Point
  status: string
  transportType: 'Sea' | 'Land' | 'Air'
  waypoints?: Waypoint[]
}

const transportIcon = { Sea: Ship, Land: Truck, Air: Plane }

function makeMarker(kind: 'origin' | 'destination' | 'current' | Waypoint['status']) {
  return divIcon({
    className: `route-map-marker route-map-marker-${kind}`,
    html: '<span></span>',
    iconAnchor: [9, 9],
    iconSize: [18, 18],
  })
}

function FitToRoute({ points }: { points: Array<[number, number]> }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 5)
      return
    }
    map.fitBounds(latLngBounds(points), { padding: [40, 40] })
  }, [map, points])
  return null
}

export function InteractiveRouteMap({
  title,
  operationReference,
  originPort,
  destinationPort,
  currentPosition,
  status,
  transportType,
  waypoints = [],
}: InteractiveRouteMapProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const Icon = transportIcon[transportType] ?? Ship

  const routePoints = useMemo<Array<[number, number]>>(() => {
    const ordered = [
      [originPort.lat, originPort.lng] as [number, number],
      ...waypoints.map((w) => [w.lat, w.lng] as [number, number]),
      [destinationPort.lat, destinationPort.lng] as [number, number],
    ]
    return ordered
  }, [originPort, destinationPort, waypoints])

  const allPoints = useMemo<Array<[number, number]>>(() => {
    const points = [...routePoints]
    if (currentPosition) points.push([currentPosition.lat, currentPosition.lng])
    return points
  }, [routePoints, currentPosition])

  return (
    <article className="route-map" aria-label={`${title} route map`}>
      <header className="route-map-head">
        <div className="route-map-title">
          <span className="route-map-transport"><Icon size={15} aria-hidden="true" /></span>
          <div>
            <b>{title}</b>
            {operationReference && <small>{operationReference}</small>}
          </div>
        </div>
        <span className="route-map-status">{status}</span>
      </header>

      <div className="route-map-canvas">
        {mounted && (
          <MapContainer
            center={[originPort.lat, originPort.lng]}
            zoom={4}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
            scrollWheelZoom={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitToRoute points={allPoints} />
            <Polyline positions={routePoints} pathOptions={{ color: '#8b5cf6', weight: 3, dashArray: '6 8' }} />

            <Marker icon={makeMarker('origin')} position={[originPort.lat, originPort.lng]}>
              <Popup><b>{originPort.name}</b><br />Origen</Popup>
            </Marker>

            {waypoints.map((waypoint) => (
              <Marker key={waypoint.name} icon={makeMarker(waypoint.status)} position={[waypoint.lat, waypoint.lng]}>
                <Popup><b>{waypoint.name}</b><br />{waypoint.status}</Popup>
              </Marker>
            ))}

            {currentPosition && (
              <Marker icon={makeMarker('current')} position={[currentPosition.lat, currentPosition.lng]}>
                <Popup>
                  <b>{currentPosition.name}</b>
                  {currentPosition.vessel && <><br />{currentPosition.vessel}</>}
                </Popup>
              </Marker>
            )}

            <Marker icon={makeMarker('destination')} position={[destinationPort.lat, destinationPort.lng]}>
              <Popup><b>{destinationPort.name}</b><br />Destino</Popup>
            </Marker>
          </MapContainer>
        )}
      </div>

      <footer className="route-map-legend">
        <span className="route-map-endpoint"><Anchor size={13} aria-hidden="true" /> {originPort.name}</span>
        <span className="route-map-arrow" aria-hidden="true">→</span>
        <span className="route-map-endpoint"><Anchor size={13} aria-hidden="true" /> {destinationPort.name}</span>
      </footer>
    </article>
  )
}
