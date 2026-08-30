import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createExtractorAgent,
  parseJsonClean,
  type ExtractedLLMOutput,
} from '../../backend/src/mastra/document-extractor-llm.js';
import { reconcileShipmentDocuments } from '../../backend/src/mastra/tools/reconcile-shipment-documents.tool.js';
import { HELD_OUT_DOCUMENTS } from '../datasets/documents.js';
import groundTruthData from '../datasets/extraction_ground_truth.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../backend/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]?.trim() || '';
    }
  }
}

export type FieldResultStatus = 'match' | 'partial' | 'missing' | 'incorrect';

export interface SingleRunExtractionRecord {
  testCaseId: string;
  operationReference: string;
  fileName: string;
  documentType: string;
  runNumber: number;
  extracted: ExtractedLLMOutput;
  groundTruth: Record<string, unknown>;
  fieldResults: Record<string, FieldResultStatus>;
  discrepancyDetected?: boolean;
  latencyMs: number;
  apiTimestampStart: string;
  apiTimestampEnd: string;
  passed: boolean;
}

export interface ExtractionSuiteSummary {
  totalRuns: number;
  totalDocuments: number;
  fieldAccuracy: Record<string, number>;
  stabilityScore: number;
  discrepancyDetectionRate: number;
  discrepancyFalseNegativeRate: number;
  averageLatencyMs: number;
  consistentFailures: string[];
  intermittentFailures: string[];
  runs: SingleRunExtractionRecord[];
}

function normalizeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function evaluateField(actual: unknown, expected: unknown): FieldResultStatus {
  if (expected === undefined || expected === null || expected === '') {
    if (actual === undefined || actual === null || actual === '' || actual === 0) {
      return 'match';
    }
    return 'match';
  }

  if (actual === undefined || actual === null || actual === '' || actual === 0) {
    return 'missing';
  }

  if (typeof expected === 'number') {
    const numActual = typeof actual === 'number' ? actual : parseFloat(String(actual).replace(/[^0-9.]/g, ''));
    if (Math.abs(numActual - expected) < 0.01) return 'match';
    if (Math.abs(numActual - expected) / expected <= 0.05) return 'partial';
    return 'incorrect';
  }

  const normActual = normalizeString(actual);
  const normExpected = normalizeString(expected);

  if (normActual === normExpected) return 'match';
  if (normActual.includes(normExpected) || normExpected.includes(normActual)) return 'match';

  return 'incorrect';
}

function parseJsonClean(text: string): ExtractedLLMOutput {
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

export async function runExtractionEvalSuite(runsPerDocument: number = 3): Promise<ExtractionSuiteSummary> {
  const agent = createExtractorAgent();
  const allRuns: SingleRunExtractionRecord[] = [];
  const fieldCounts: Record<string, { matches: number; total: number }> = {};
  const documentRunOutcomes: Record<string, boolean[]> = {};
  const totalLatencies: number[] = [];

  const groundTruthMap = new Map<string, Record<string, unknown>>();
  for (const op of groundTruthData.operations) {
    for (const doc of op.documents) {
      groundTruthMap.set(doc.fileName, { ...doc, operationReference: op.operationReference });
    }
  }

  console.log(`\n  [Suite A: Extracción Real con OpenAI gpt-4o-mini] Evaluando ${HELD_OUT_DOCUMENTS.length} documentos (${runsPerDocument} corridas c/u)...`);

  for (const doc of HELD_OUT_DOCUMENTS) {
    const gt = groundTruthMap.get(doc.fileName) || {};
    documentRunOutcomes[doc.fileName] = [];

    for (let runIndex = 1; runIndex <= runsPerDocument; runIndex++) {
      const apiTimestampStart = new Date().toISOString();
      const t0 = performance.now();

      let extracted: ExtractedLLMOutput = {};
      try {
        const response = await agent.generate([
          {
            role: 'user',
            content: `Extract structured data from this document:\n\nFile Name: ${doc.fileName}\nContent:\n${doc.rawText}`,
          },
        ]);
        extracted = parseJsonClean(response.text);
      } catch (err) {
        console.error(`  [OpenAI API Error] ${doc.fileName} run ${runIndex}:`, err);
      }

      const latencyMs = Math.round(performance.now() - t0);
      const apiTimestampEnd = new Date().toISOString();
      totalLatencies.push(latencyMs);

      console.log(`    • [LLM Run ${runIndex}/${runsPerDocument}] ${doc.fileName.padEnd(45)} -> ${latencyMs}ms | docType=${extracted.documentType || 'N/A'}`);

      const fieldResults: Record<string, FieldResultStatus> = {};

      fieldResults.documentType = evaluateField(extracted.documentType, gt.documentType);

      if (gt.documentReference) {
        fieldResults.documentReference = evaluateField(extracted.documentReference, gt.documentReference);
      }
      if (gt.containerNumber) {
        fieldResults.containerNumber = evaluateField(extracted.containerNumber, gt.containerNumber);
      }
      if (gt.vessel) {
        fieldResults.vessel = evaluateField(extracted.vessel, gt.vessel);
      }
      if (gt.originPort) {
        fieldResults.originPort = evaluateField(extracted.originPort, gt.originPort);
      }
      if ('destinationPort' in gt) {
        fieldResults.destinationPort = evaluateField(extracted.destinationPort, gt.destinationPort);
      }
      if (gt.grossWeightKg) {
        fieldResults.grossWeightKg = evaluateField(extracted.grossWeightKg, gt.grossWeightKg);
      }
      if (gt.totalUsd) {
        fieldResults.totalUsd = evaluateField(extracted.totalUsd, gt.totalUsd);
      }

      for (const [field, status] of Object.entries(fieldResults)) {
        if (!fieldCounts[field]) fieldCounts[field] = { matches: 0, total: 0 };
        fieldCounts[field].total++;
        if (status === 'match' || status === 'partial') {
          fieldCounts[field].matches++;
        }
      }

      const isRunPassed = Object.values(fieldResults).every((st) => st === 'match' || st === 'partial');
      documentRunOutcomes[doc.fileName].push(isRunPassed);

      allRuns.push({
        testCaseId: `eval-extract-${doc.operationReference}-${doc.fileName}-r${runIndex}`,
        operationReference: doc.operationReference,
        fileName: doc.fileName,
        documentType: extracted.documentType || 'OTHER',
        runNumber: runIndex,
        extracted,
        groundTruth: gt,
        fieldResults,
        latencyMs,
        apiTimestampStart,
        apiTimestampEnd,
        passed: isRunPassed,
      });
    }
  }

  // Discrepancy checks
  let discrepancyTests = 0;
  let discrepancyDetected = 0;

  const reconWeight = reconcileShipmentDocuments({
    billOfLading: { containerNumber: 'HDMU4491028', weightKg: 26500, amountUsd: 195000 },
    commercialInvoice: { containerNumber: 'HDMU4491028', weightKg: 26500, amountUsd: 195000 },
    packingList: { containerNumber: 'HDMU4491028', weightKg: 24100, amountUsd: 195000 },
  });
  discrepancyTests++;
  if (reconWeight.status === 'discrepancy' && reconWeight.discrepancies.some((d) => d.field === 'weightKg')) {
    discrepancyDetected++;
  }

  const reconContainer = reconcileShipmentDocuments({
    billOfLading: { containerNumber: 'HLCU8819203', weightKg: 22000, amountUsd: 115000 },
    commercialInvoice: { containerNumber: 'HLCU8819203', weightKg: 22000, amountUsd: 115000 },
    packingList: { containerNumber: 'HLCU8819208', weightKg: 22000, amountUsd: 115000 },
  });
  discrepancyTests++;
  if (reconContainer.status === 'discrepancy' && reconContainer.discrepancies.some((d) => d.field === 'containerNumber')) {
    discrepancyDetected++;
  }

  const fieldAccuracy: Record<string, number> = {};
  for (const [field, count] of Object.entries(fieldCounts)) {
    fieldAccuracy[field] = Math.round((count.matches / count.total) * 1000) / 10;
  }

  const consistentFailures: string[] = [];
  const intermittentFailures: string[] = [];
  let fullyPassedCount = 0;

  for (const [fileName, outcomes] of Object.entries(documentRunOutcomes)) {
    const passedCount = outcomes.filter(Boolean).length;
    if (passedCount === outcomes.length) {
      fullyPassedCount++;
    } else if (passedCount === 0) {
      consistentFailures.push(fileName);
    } else {
      intermittentFailures.push(`${fileName} (${passedCount}/${outcomes.length} passed)`);
    }
  }

  const stabilityScore = Math.round((fullyPassedCount / HELD_OUT_DOCUMENTS.length) * 1000) / 10;
  const discrepancyDetectionRate = Math.round((discrepancyDetected / discrepancyTests) * 1000) / 10;
  const discrepancyFalseNegativeRate = Math.round(((discrepancyTests - discrepancyDetected) / discrepancyTests) * 1000) / 10;
  const averageLatencyMs = Math.round(totalLatencies.reduce((a, b) => a + b, 0) / (totalLatencies.length || 1));

  return {
    totalRuns: allRuns.length,
    totalDocuments: HELD_OUT_DOCUMENTS.length,
    fieldAccuracy,
    stabilityScore,
    discrepancyDetectionRate,
    discrepancyFalseNegativeRate,
    averageLatencyMs,
    consistentFailures,
    intermittentFailures,
    runs: allRuns,
  };
}
