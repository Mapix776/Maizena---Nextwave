'use client'

import { useState, useEffect } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Search, X, Ship, Package, MapPin } from 'lucide-react'
import { getBackendUrl } from '@/lib/backend-url'

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [center, zoom, map])
  return null
}

export interface MapLocation {
  name: string
  country: string
  coordinates: [number, number] // [lat, lng]
  runs: number
  containers?: string[]
}

const DEFAULT_LOCATIONS: MapLocation[] = [
  { name: 'Buenaventura', country: 'Colombia', coordinates: [3.882, -77.031], runs: 4, containers: ['MSKU-902134-1', 'COSU-449102-8'] },
  { name: 'Cartagena', country: 'Colombia', coordinates: [10.399, -75.514], runs: 3, containers: ['HLXU-882194-0'] },
  { name: 'Manzanillo', country: 'Mexico', coordinates: [19.052, -104.316], runs: 5, containers: ['TGHU-910283-4', 'MSKU-771920-3'] },
  { name: 'Shanghai', country: 'China', coordinates: [31.230, 121.473], runs: 6, containers: ['CMAU-128491-9'] },
  { name: 'Rotterdam', country: 'Netherlands', coordinates: [51.924, 4.477], runs: 3, containers: ['SUDU-551029-7'] },
  { name: 'Miami', country: 'United States', coordinates: [25.761, -80.191], runs: 2, containers: ['EGLV-001928-3'] },
]

const operationMarker = divIcon({
  className: 'route-map-marker',
  html: '<span class="flex size-4 items-center justify-center rounded-full bg-purple-600 ring-4 ring-purple-200 shadow-md animate-pulse"></span>',
  iconAnchor: [8, 8],
  iconSize: [16, 16],
})

export default function OperationsMapView() {
  const [locations, setLocations] = useState<MapLocation[]>(DEFAULT_LOCATIONS)
  const [search, setSearch] = useState('')
  const [zoom, setZoom] = useState(4)
  const [layer, setLayer] = useState('Operations')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/map/locations`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.locations) && data.locations.length > 0) {
          setLocations(data.locations)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const results = locations.filter((location) =>
    `${location.name} ${location.country} ${(location.containers || []).join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const selected = results[0] ?? locations[0] ?? DEFAULT_LOCATIONS[0]

  return (
    <div className="map-page">
      <div className="view-heading">
        <div>
          <p className="section-kicker">Red Geográfica en Vivo</p>
          <h2>Mapa de Operaciones</h2>
          <p>Supervisa puertos, buques y contenedores activos en tiempo real conectado a la base de datos.</p>
        </div>
        <span className="map-live">
          <i /> {loading ? 'Cargando red...' : `${locations.length} Puertos Activos`}
        </span>
      </div>

      <div className="map-layout">
        <div className="panel full-map-panel">
          <div className="full-map-toolbar">
            <label className="map-search">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar puerto, país o contenedor (ej: Buenaventura, MSKU)..."
                aria-label="Buscar puerto o país"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                  <X size={13} />
                </button>
              )}
            </label>
            <div className="map-controls">
              <button onClick={() => setZoom(Math.min(14, zoom + 1))} aria-label="Acercar">+</button>
              <button onClick={() => setZoom(Math.max(2, zoom - 1))} aria-label="Alejar">−</button>
              <button onClick={() => { setZoom(3); setSearch('') }} aria-label="Restablecer">⌂</button>
            </div>
          </div>

          <div className="layer-tabs">
            {['Operations', 'Ports', 'Vessels'].map((item) => (
              <button
                className={layer === item ? 'selected' : ''}
                key={item}
                onClick={() => setLayer(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="large-map-canvas">
            <MapContainer
              center={selected.coordinates}
              zoom={zoom}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <ChangeView center={selected.coordinates} zoom={zoom} />
              {results.map((location) => (
                <Marker icon={operationMarker} key={location.name} position={location.coordinates}>
                  <Popup>
                    <div className="space-y-1 p-1 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <MapPin size={13} className="text-purple-600" />
                        <span>{location.name}, {location.country}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-600">
                        <Ship size={12} />
                        <span><b>{location.runs}</b> operaciones activas</span>
                      </div>
                      {location.containers && location.containers.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-slate-200">
                          <div className="flex items-center gap-1 font-semibold text-slate-700">
                            <Package size={11} /> Contenedores:
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {location.containers.slice(0, 3).map((c) => (
                              <span key={c} className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                {c}
                              </span>
                            ))}
                            {location.containers.length > 3 && (
                              <span className="text-[10px] text-slate-400">+{location.containers.length - 3} más</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
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
