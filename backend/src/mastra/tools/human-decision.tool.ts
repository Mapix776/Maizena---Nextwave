import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { StepResult } from '../../contracts/step-result.js';

export const humanDecisionOptionSchema = z
  .object({
    id: z.string().min(1).describe('Option identifier (e.g. container number, operation code, or choice ID).'),
    label: z.string().min(1).describe('User-friendly title for non-technical clients (e.g. "📦 Container MSKU1234567 (50 Wooden Dining Tables)").'),
    description: z.string().min(1).describe('Plain-language summary of what this option represents (location, dates, or action).'),
    badge: z.string().optional().describe('Visual tag (e.g. "In Transit", "Customs Clearance", "Delivered", "Action Required").'),
    actionPayload: z.string().optional().describe('Text or instruction sent back when the user selects this option.'),
  })
  .strict();

export const requestHumanDecisionInputSchema = z
  .object({
    assistantResponse: z
      .string()
      .min(1)
      .describe('Clear, friendly explanation in plain English presenting the options to the client.'),
    title: z
      .string()
      .min(1)
      .describe('Title of the decision card (e.g. "Select Shipment to Inspect" or "Approval Required").'),
    question: z
      .string()
      .min(1)
      .describe('The specific question asked to the user (e.g. "Which of these 3 containers containing tables would you like to inspect in detail?").'),
    severity: z
      .enum(['normal', 'warning', 'critical'])
      .default('normal')
      .describe('Severity level determining the visual indicator color.'),
    options: z
      .array(humanDecisionOptionSchema)
      .min(1)
      .describe('List of clickable options presented to the user.'),
  })
  .strict();

export function createRequestHumanDecisionTool() {
  return createTool({
    id: 'request-human-decision',
    description:
      'Pause execution and present an interactive Human-in-the-Loop decision or selection card to the non-technical client with clickable options (e.g. when multiple shipments match a product query like "tables", or when an operational decision requires approval).',
    inputSchema: requestHumanDecisionInputSchema,
    execute: async (input): Promise<StepResult> => {
      return {
        status: 'completed',
        summary: input.assistantResponse,
        factPatch: {
          assistantResponse: input.assistantResponse,
          humanDecision: {
            title: input.title,
            question: input.question,
            severity: input.severity,
            options: input.options,
          },
        },
        evidence: [
          {
            id: 'human-in-the-loop-prompt',
            source: 'json-render:HumanDecisionCard',
          },
        ],
      };
    },
  });
}
