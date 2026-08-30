import { z } from 'zod';

export const orderIncidentSeveritySchema = z.enum(['warning', 'critical']);

export const raiseOrderIncidentInputSchema = z
  .object({
    orderId: z.string().trim().min(1).max(128),
    type: z.string().trim().min(1).max(64),
    severity: orderIncidentSeveritySchema,
    message: z.string().trim().min(1).max(500),
  })
  .strict();

export const orderIncidentSchema = raiseOrderIncidentInputSchema.extend({
  incidentId: z.string().uuid(),
  raisedAt: z.string().datetime(),
});

export const orderIncidentsSnapshotSchema = z
  .object({
    incidents: z.array(orderIncidentSchema),
  })
  .strict();

export type RaiseOrderIncidentInput = z.infer<
  typeof raiseOrderIncidentInputSchema
>;
export type OrderIncident = z.infer<typeof orderIncidentSchema>;
export type OrderIncidentsSnapshot = z.infer<
  typeof orderIncidentsSnapshotSchema
>;
