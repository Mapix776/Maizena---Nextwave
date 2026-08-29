import { z } from 'zod';

export const stepResultSchema = z
  .object({
    status: z.literal('completed'),
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

export type StepResult = z.infer<typeof stepResultSchema>;
