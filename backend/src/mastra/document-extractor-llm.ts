import { Agent } from '@mastra/core/agent';
import { createSmallModel, SMALL_REASONING_EFFORT } from './models.js';

export interface ExtractedLLMOutput {
  documentType?: string;
  documentReference?: string;
  clientName?: string;
  originPort?: string;
  destinationPort?: string;
  vessel?: string;
  containerNumber?: string;
  grossWeightKg?: number;
  totalUsd?: number;
}

export const EXTRACTOR_SYSTEM_PROMPT = `You are Nauta's expert logistics document parsing intelligence.
Analyze the raw text of the provided international shipping/commercial document and extract structured facts with high precision.
Return ONLY a valid, raw JSON object (without markdown fences or extra commentary) matching this schema:
{
  "documentType": "BOOKING_CONFIRMATION" | "BILL_OF_LADING" | "COMMERCIAL_INVOICE" | "PACKING_LIST" | "PURCHASE_ORDER" | "PEDIMENTO" | "ARRIVAL_NOTICE" | "OTHER",
  "documentReference": "string (the exact reference code of this document, e.g. PO-2026-9101, COSCOBL9101001, COSU9101001, PL-2026-9101)",
  "clientName": "string (the buyer, consignee, or ordering customer company name)",
  "originPort": "string (the Port of Loading / Origin Port / Ladehafen / POL / FOB Port)",
  "destinationPort": "string (the Port of Discharge / Destination Port / Bestimmungsort / POD / CIF Port. If stated as pending, not specified, or missing, return empty string \\"\\")",
  "vessel": "string (ship or ocean vessel name if present, e.g. COSCO HARMONY, ONE APUS, HYUNDAI BRAVE, ROTTERDAM EXPRESS, MSC AGRIPPINO, CMA CGM MONTMARTRE)",
  "containerNumber": "string (ISO 6346 4-letter 7-digit container code if present, e.g. COSU9182734, ONEU7738192, HDMU4491028, HLCU8819203, MSCU3391024, CMAU5591028)",
  "grossWeightKg": 0 (total gross weight in kg as a numeric number, e.g. 14800, 21400, 26500, 24100, 22000, 19200, 16400),
  "totalUsd": 0 (total monetary value in USD as a numeric number, e.g. 142500, 88900, 195000, 115000, 76800, 168000)
}

Rules:
1. For documentType: recognize German (Bestellung -> PURCHASE_ORDER, Lieferschein -> PACKING_LIST), English, Spanish.
2. For totalUsd: extract the total declared value or total purchase order/invoice value in USD as a numeric float.
3. For grossWeightKg: extract numeric gross weight.
4. Return pure JSON without explanation.`;

export function createExtractorAgent(): Agent {
  return new Agent({
    id: 'document-extractor-llm',
    name: 'DocumentExtractorLLM',
    instructions: {
      role: 'system',
      content: EXTRACTOR_SYSTEM_PROMPT,
      providerOptions: {
        openai: { reasoningEffort: SMALL_REASONING_EFFORT },
      },
    },
    model: createSmallModel(),
  });
}

export function parseJsonClean(text: string): ExtractedLLMOutput {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as ExtractedLLMOutput;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as ExtractedLLMOutput;
      } catch {
        return {};
      }
    }
    return {};
  }
}
