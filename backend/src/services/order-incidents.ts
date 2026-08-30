import { randomUUID } from 'node:crypto';

import type {
  OrderIncident,
  OrderIncidentsSnapshot,
  RaiseOrderIncidentInput,
} from '../contracts/order-incident.js';

export interface OrderIncidentStore {
  raise(input: RaiseOrderIncidentInput): OrderIncident;
  acknowledge(incidentId: string): OrderIncidentsSnapshot;
  reset(): OrderIncidentsSnapshot;
  snapshot(): OrderIncidentsSnapshot;
}

export function createOrderIncidentStore(): OrderIncidentStore {
  let incidents: OrderIncident[] = [];

  const snapshot = (): OrderIncidentsSnapshot => ({
    incidents: [...incidents],
  });

  return {
    raise(input) {
      const incident: OrderIncident = {
        ...input,
        incidentId: randomUUID(),
        raisedAt: new Date().toISOString(),
      };
      incidents = [incident, ...incidents];
      return incident;
    },
    acknowledge(incidentId) {
      incidents = incidents.filter(
        (incident) => incident.incidentId !== incidentId,
      );
      return snapshot();
    },
    reset() {
      incidents = [];
      return snapshot();
    },
    snapshot,
  };
}
