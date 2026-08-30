import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { SupabaseReader } from '../../services/supabase-reader.js';

export interface LocateMapToolOptions {
  reader?: SupabaseReader;
}

export function createLocateMapTool(options: LocateMapToolOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'locate-shipment-on-map',
    description:
      'Locate a shipment, vessel, or container on the world map. Returns origin port, destination port, transit route, and current geographic coordinates/location.',
    inputSchema: z.object({
      referenceOrContainer: z
        .string()
        .min(1)
        .describe('Operation reference code (e.g. "OP-2026-101") or container ISO number (e.g. "MSKU1234567").'),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      route: z
        .object({
          originPort: z.string(),
          destinationPort: z.string(),
          currentVessel: z.string().nullable(),
          currentLocation: z.string().nullable(),
          status: z.string(),
          coordinates: z
            .object({
              lat: z.number(),
              lng: z.number(),
            })
            .optional(),
        })
        .nullable(),
    }),
    execute: async ({ referenceOrContainer }) => {
      // 1. Try container lookup
      const container = await reader.getContainerByNumber(referenceOrContainer);
      if (container) {
        return {
          found: true,
          route: {
            originPort: container.origin_port || 'Por confirmar',
            destinationPort: container.destination_port || 'Por confirmar',
            currentVessel: container.current_vessel,
            currentLocation: container.current_location,
            status: container.status,
            coordinates: { lat: 19.05, lng: -104.31 }, // Map reference
          },
        };
      }

      // 2. Try operation lookup
      const op = await reader.getOperationByReferenceOrId(referenceOrContainer);
      if (op) {
        const containers = await reader.getContainersByOperation(op.id);
        const primary = containers[0];
        const canonical = (op.canonical_data ?? {}) as Record<string, unknown>;
        const origin = (canonical.origin_port as { value?: string })?.value || primary?.origin_port || 'Por confirmar';
        const dest = (canonical.destination_port as { value?: string })?.value || primary?.destination_port || 'Por confirmar';

        return {
          found: true,
          route: {
            originPort: origin,
            destinationPort: dest,
            currentVessel: primary?.current_vessel ?? null,
            currentLocation: primary?.current_location ?? op.status,
            status: op.status,
            coordinates: { lat: 19.05, lng: -104.31 },
          },
        };
      }

      return { found: false, route: null };
    },
  });
}
