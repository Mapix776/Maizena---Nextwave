export type Point = { name: string; lat: number; lng: number; vessel?: string }
export type Waypoint = { name: string; lat: number; lng: number; status: 'completed' | 'current' | 'pending' }

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
