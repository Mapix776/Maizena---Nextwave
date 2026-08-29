'use client'

import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Search, X } from 'lucide-react'

const countryPins = [
  { name: 'España', coordinates: [-3.7, 40.4] as [number, number], value: '12 runs' },
  { name: 'Francia', coordinates: [2.2, 46.2] as [number, number], value: '8 runs' },
  { name: 'Portugal', coordinates: [-8.2, 39.5] as [number, number], value: '3 runs' },
]

export default function FleetMap() {
  const [country, setCountry] = useState('')
  const filteredPins = country
    ? countryPins.filter((pin) => pin.name.toLowerCase().includes(country.toLowerCase()))
    : countryPins

  return (
    <div className="panel map-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Cobertura europea</p>
          <h3>Mapa de operaciones</h3>
        </div>
        <span className="map-live"><i /> En vivo</span>
      </div>
      <label className="map-search">
        <Search size={14} />
        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Buscar país..." aria-label="Buscar país" />
        {country && <button onClick={() => setCountry('')} aria-label="Limpiar país"><X size={13} /></button>}
      </label>
      <div className="map-canvas">
        <MapContainer center={[43, 2]} zoom={4} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {filteredPins.map((pin) => (
            <Marker key={pin.name} position={pin.coordinates}>
              <Popup>
                <b>{pin.name}</b>
                <br />
                {pin.value}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="map-legend">
        {filteredPins.length
          ? filteredPins.map((pin) => (
              <button key={pin.name} onClick={() => setCountry(pin.name)}>
                <i />
                {pin.name}
                <b>{pin.value}</b>
              </button>
            ))
          : <span>No hay operaciones para ese país</span>}
      </div>
    </div>
  )
}