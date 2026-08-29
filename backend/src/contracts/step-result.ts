import { z } from 'zod';

export const stepResultSchema = z
  .object({
    status: z.enum(['completed', 'skipped', 'waiting_human', 'failed']),
    summary: z.string().min(1),
    factPatch: z.record(z.string(), z.unknown()).optional(),
    findings: z
      .array(
        z
          .object({
            id: z.string().min(1),
            statement: z.string().min(1),
            evidenceIds: z.array(z.string().min(1)),
          })
          .strict(),
      )
      .optional(),
    evidence: z.array(
      z
        .object({
          id: z.string().min(1),
          source: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

export interface StepResult {
  status: 'completed' | 'skipped' | 'waiting_human' | 'failed';
  summary: string;
  factPatch?: Record<string, unknown>;
  findings?: Array<{
    id: string;
    statement: string;
    evidenceIds: string[];
  }>;
  evidence: Array<{
    id: string;
    source: string;
  }>;
}
