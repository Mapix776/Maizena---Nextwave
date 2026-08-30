'use client'

import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

import type {
  OrderIncident,
  OrderIncidentsSnapshot,
} from '../../backend/src/contracts/order-incident'

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

export interface UseOrderIncidentsResult {
  incidents: OrderIncident[]
  acknowledge(incidentId: string): Promise<void>
}

export function useOrderIncidents(): UseOrderIncidentsResult {
  const [incidents, setIncidents] = useState<OrderIncident[]>([])

  useEffect(() => {
    const socket = io(backendUrl, { transports: ['websocket'] })

    socket.on(
      'incidents:snapshot',
      (snapshot: OrderIncidentsSnapshot) => setIncidents(snapshot.incidents),
    )

    return () => {
      socket.disconnect()
    }
  }, [])

  const acknowledge = useCallback(async (incidentId: string) => {
    await fetch(
      `${backendUrl}/api/demo/incidents/${encodeURIComponent(incidentId)}/acknowledge`,
      { method: 'POST' },
    )
  }, [])

  return { incidents, acknowledge }
}
