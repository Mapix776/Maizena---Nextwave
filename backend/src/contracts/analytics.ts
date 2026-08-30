import { z } from 'zod';
import { interactiveChartPropsSchema } from './ui.js';

export const chartSizeSchema = z.enum(['small', 'medium', 'large']).default('medium');
export type ChartSize = z.infer<typeof chartSizeSchema>;

export const pinnedChartSchema = z.object({
  id: z.string().min(1),
  chart: interactiveChartPropsSchema,
  size: chartSizeSchema,
  order: z.number().int().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PinnedChart = z.infer<typeof pinnedChartSchema>;

export const pinChartInputSchema = z.object({
  chart: interactiveChartPropsSchema,
  size: chartSizeSchema.optional(),
});
export type PinChartInput = z.infer<typeof pinChartInputSchema>;

export const updatePinnedChartInputSchema = z.object({
  size: chartSizeSchema.optional(),
  order: z.number().int().optional(),
  chart: interactiveChartPropsSchema.optional(),
});
export type UpdatePinnedChartInput = z.infer<typeof updatePinnedChartInputSchema>;
