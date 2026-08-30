'use client'

import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

import type {
  OrderIncident,
  OrderIncidentsSnapshot,
} from '../../backend/src/contracts/order-incident'

import { getBackendUrl } from './backend-url'

const backendUrl = getBackendUrl()

export interface UseOrderIncidentsResult {
  incidents: OrderIncident[]
  acknowledge(incidentId: string): Promise<void>
}

export function useOrderIncidents(): UseOrderIncidentsResult {
  const [incidents, setIncidents] = useState<OrderIncident[]>([])

  useEffect(() => {
    const url = getBackendUrl()
    const socket = io(url, { transports: ['websocket'] })

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
