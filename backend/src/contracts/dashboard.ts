import { z } from 'zod';

export const dashboardItemKindSchema = z.enum([
  'full_spec',
  'chart',
  'decision',
  'table',
  'metrics',
  'route_map',
  'alert_list',
  'custom',
]);
export type DashboardItemKind = z.infer<typeof dashboardItemKindSchema>;

export const dashboardItemSizeSchema = z.enum(['small', 'medium', 'large']).default('medium');
export type DashboardItemSize = z.infer<typeof dashboardItemSizeSchema>;

export const dashboardItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  kind: dashboardItemKindSchema,
  payload: z.record(z.string(), z.unknown()),
  size: dashboardItemSizeSchema,
  order: z.number().int().default(0),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DashboardItem = z.infer<typeof dashboardItemSchema>;

export const saveDashboardItemInputSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  kind: dashboardItemKindSchema,
  payload: z.record(z.string(), z.unknown()),
  size: dashboardItemSizeSchema.optional(),
  tags: z.array(z.string()).optional(),
});
export type SaveDashboardItemInput = z.infer<typeof saveDashboardItemInputSchema>;

export const updateDashboardItemInputSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  size: dashboardItemSizeSchema.optional(),
  order: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateDashboardItemInput = z.infer<typeof updateDashboardItemInputSchema>;
