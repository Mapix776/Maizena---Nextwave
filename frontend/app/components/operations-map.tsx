'use client'

import { useState, useEffect } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Search, X } from 'lucide-react'

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [center, zoom, map])
  return null
}

const locations = [
  { name: 'Madrid', country: 'Spain', coordinates: [-3.7, 40.4] as [number, number], runs: 12 },
  { name: 'Barcelona', country: 'Spain', coordinates: [2.17, 41.38] as [number, number], runs: 7 },
  { name: 'Lisbon', country: 'Portugal', coordinates: [-9.14, 38.72] as [number, number], runs: 3 },
  { name: 'Paris', country: 'France', coordinates: [2.35, 48.85] as [number, number], runs: 8 },
  { name: 'Lyon', country: 'France', coordinates: [4.83, 45.76] as [number, number], runs: 5 },
]

const operationMarker = divIcon({
  className: 'route-map-marker',
  html: '<span></span>',
  iconAnchor: [9, 9],
  iconSize: [18, 18],
})

export default function OperationsMapView() {
  const [search, setSearch] = useState('')
  const [zoom, setZoom] = useState(5)
  const [layer, setLayer] = useState('Operations')
  const results = locations.filter((location) =>
    `${location.name} ${location.country}`.toLowerCase().includes(search.toLowerCase())
  )
  const selected = results[0] ?? locations[0]

  return (
    <div className="map-page">
      <div className="view-heading">
        <div>
          <p className="section-kicker">Geographic network</p>
          <h2>Operations map</h2>
          <p>Explore countries, cities and active points of your logistics network.</p>
        </div>
        <span className="map-live"><i /> Live data</span>
      </div>
      <div className="map-layout">
        <div className="panel full-map-panel">
          <div className="full-map-toolbar">
            <label className="map-search">
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search country or city..." aria-label="Search country or city" />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={13} /></button>}
            </label>
            <div className="map-controls">
              <button onClick={() => setZoom(Math.min(14, zoom + 1))} aria-label="Zoom in">+</button>
              <button onClick={() => setZoom(Math.max(3, zoom - 1))} aria-label="Zoom out">−</button>
              <button onClick={() => setZoom(5)} aria-label="Reset map">⌂</button>
            </div>
          </div>
          <div className="layer-tabs">
            {['Operations', 'Cities', 'Streets'].map((item) => (
              <button className={layer === item ? 'selected' : ''} key={item} onClick={() => setLayer(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="large-map-canvas">
            <MapContainer center={[selected.coordinates[0], selected.coordinates[1]]} zoom={zoom} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <ChangeView center={[selected.coordinates[0], selected.coordinates[1]]} zoom={zoom} />
              {locations.map((location) => (
                <Marker icon={operationMarker} key={location.name} position={location.coordinates}>
                  <Popup>
                    <b>{location.name}</b>
                    <br />
                    {location.country}
                    <br />
                    {location.runs} runs
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
