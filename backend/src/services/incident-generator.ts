import type { RaiseOrderIncidentInput } from '../contracts/order-incident.js';

/**
 * Rotating pool of realistic supply-chain incidents for the Maizena / Nextwave
 * demo. Each template mirrors the kind of alert an operations agent would raise
 * so the Incidents view stays lively without manual seeding.
 */
const INCIDENT_TEMPLATES: ReadonlyArray<
  Omit<RaiseOrderIncidentInput, 'orderId'>
> = [
  {
    type: 'Cold-chain breach',
    severity: 'critical',
    message:
      'Reefer unit on truck TX-118 rose to 12.4°C for 22 min near Puebla. 3 SKUs of Maizena at risk; ETA slips 40 min.',
  },
  {
    type: 'Delivery delay',
    severity: 'warning',
    message:
      'Carrier reported traffic on the MEX-Qro corridor. Order projected 35 min late; customer SLA still within grace window.',
  },
  {
    type: 'Stock shortfall',
    severity: 'warning',
    message:
      'Guadalajara DC shows 8 pallets short vs the committed load for route R-22. Suggest partial dispatch + backfill.',
  },
  {
    type: 'Route deviation',
    severity: 'warning',
    message:
      'Driver on route R-14 left the geofenced corridor by 6 km. No stop scheduled; confirming with dispatch.',
  },
  {
    type: 'Damaged pallet',
    severity: 'critical',
    message:
      'Dock scan at Monterrey CEDIS flagged a crushed pallet (16 cases Maizena 1kg). Quarantined; replacement needed before cutoff.',
  },
  {
    type: 'Failed delivery',
    severity: 'critical',
    message:
      'Consignee at Tienda Sol closed on arrival. Order ORD returned to hub; reschedule window closing in 2 h.',
  },
  {
    type: 'Temperature warning',
    severity: 'warning',
    message:
      'Trailer sensor trending up (7.8°C, limit 8°C) on the León leg. Pre-alert issued to driver to check reefer setpoint.',
  },
  {
    type: 'Customs hold',
    severity: 'warning',
    message:
      'Cross-border shipment held at Nuevo Laredo for document review. Estimated 90 min clearance; downstream loads unaffected.',
  },
  {
    type: 'Inventory mismatch',
    severity: 'warning',
    message:
      'Cycle count at Toluca DC found -12 cases variance on lot MZ-2291. Investigating pick error vs receiving discrepancy.',
  },
  {
    type: 'Vehicle breakdown',
    severity: 'critical',
    message:
      'Unit TX-204 reported engine fault on the Bajío route. Roadside assist dispatched; 2 stops need reassignment now.',
  },
];

function randomOrderId(): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${suffix}`;
}

/**
 * Picks one incident template at random and stamps it with a fresh order id.
 * The `avoidType` guard prevents emitting the same incident type twice in a row.
 */
export function nextGeneratedIncident(
  avoidType?: string,
): RaiseOrderIncidentInput {
  const candidates = avoidType
    ? INCIDENT_TEMPLATES.filter((template) => template.type !== avoidType)
    : INCIDENT_TEMPLATES;
  const pool = candidates.length > 0 ? candidates : INCIDENT_TEMPLATES;
  const template = pool[Math.floor(Math.random() * pool.length)];

  return {
    ...template,
    orderId: randomOrderId(),
  };
}

export interface IncidentAutoGenerator {
  start(): void;
  stop(): void;
}

/**
 * Emits a new random incident on a fixed cadence (default 4 minutes). It fires
 * one incident immediately on start so the view is never empty, then repeats on
 * the interval. Safe to start/stop repeatedly; the timer is unref'd so it never
 * keeps the process alive on its own.
 */
export function createIncidentAutoGenerator(options: {
  raise: (input: RaiseOrderIncidentInput) => void;
  intervalMs?: number;
  emitImmediately?: boolean;
}): IncidentAutoGenerator {
  const intervalMs = options.intervalMs ?? 4 * 60 * 1000;
  let timer: NodeJS.Timeout | null = null;
  let lastType: string | undefined;

  const emit = () => {
    const incident = nextGeneratedIncident(lastType);
    lastType = incident.type;
    options.raise(incident);
  };

  return {
    start() {
      if (timer) return;
      if (options.emitImmediately !== false) {
        emit();
      }
      timer = setInterval(emit, intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
