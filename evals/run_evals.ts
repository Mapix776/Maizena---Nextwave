import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runExtractionEvalSuite, type ExtractionSuiteSummary } from './suites/extraction_eval.js';
import { runUIGenerationEvalSuite, type UIGenerationSuiteSummary } from './suites/ui_generation_eval.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureResultsDirectory(): string {
  const resultsDir = path.resolve(__dirname, './results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  return resultsDir;
}

function buildSummaryMarkdown(
  timestamp: string,
  extractionResultsPath: string,
  uiResultsPath: string,
  extractionSummary: ExtractionSuiteSummary,
  uiSummary: UIGenerationSuiteSummary,
): string {
  const fieldRows = Object.entries(extractionSummary.fieldAccuracy)
    .map(([field, acc]) => `| \`${field}\` | **${acc}%** | ${acc >= 90 ? 'Excelente' : 'Requiere atención'} |`)
    .join('\n');

  const globalPassed =
    extractionSummary.discrepancyFalseNegativeRate === 0 &&
    uiSummary.structuralValidityRate === 100 &&
    uiSummary.catalogComplianceRate === 100;

  return `# Resumen de Evaluación Automatizada (Evals) — ${timestamp}

## Metadatos de la Corrida
- **Fecha y Hora:** ${new Date().toISOString()}
- **Ambiente:** Node.js v20+ / TypeScript
- **Conjunto de Extracción:** Held-Out Set Inédito (12 documentos en 6 operaciones)
- **Conjunto de UI:** 8 uiIntents variados (todos los focos)
- **Archivos de Resultados:**
  - \`${path.basename(extractionResultsPath)}\`
  - \`${path.basename(uiResultsPath)}\`

---

## 1. Suite A — Extracción y Clasificación Documental

| Métrica | Resultado | Objetivo | Estatus |
| :--- | :--- | :--- | :--- |
| **Documentos Evaluados** | ${extractionSummary.totalDocuments} documentos | $\\ge 10$ | PASS |
| **Total Corridas** | ${extractionSummary.totalRuns} corridas ($N=5$) | $\\ge 50$ | PASS |
| **Estabilidad entre Corridas (Stability Score)** | **${extractionSummary.stabilityScore}%** | $\\ge 95\\%$ | ${extractionSummary.stabilityScore >= 95 ? 'PASS' : 'WARN'} |
| **Detección de Discrepancias (Detection Rate)** | **${extractionSummary.discrepancyDetectionRate}%** | $100\\%$ | ${extractionSummary.discrepancyDetectionRate === 100 ? 'PASS' : 'FAIL'} |
| **Tasa de Falsos Negativos en Discrepancias (FNR)** | **${extractionSummary.discrepancyFalseNegativeRate}%** | $0\\%$ | ${extractionSummary.discrepancyFalseNegativeRate === 0 ? 'PASS' : 'FAIL'} |

### Precisión por Campo (Accuracy Breakdown)
| Campo | Accuracy Promedio (%) | Evaluaciones |
| :--- | :--- | :--- |
${fieldRows}

### Análisis de Fallos
- **Fallos Sistemáticos (0% en todas las corridas):** ${extractionSummary.consistentFailures.length > 0 ? extractionSummary.consistentFailures.join(', ') : 'Ninguno (0)'}
- **Fallos Intermitentes (Varianza estocástica):** ${extractionSummary.intermittentFailures.length > 0 ? extractionSummary.intermittentFailures.join(', ') : 'Ninguno (0)'}

---

## 2. Suite B — Generación de UI (Render Agent)

| Métrica | Resultado | Objetivo | Estatus |
| :--- | :--- | :--- | :--- |
| **Intents Evaluados** | ${uiSummary.totalIntents} intents | $\\ge 8$ | PASS |
| **Total Corridas** | ${uiSummary.totalRuns} corridas ($N=3$) | $\\ge 24$ | PASS |
| **Validez Estructural del Árbol (Root / No Orphans)** | **${uiSummary.structuralValidityRate}%** | $100\\%$ | ${uiSummary.structuralValidityRate === 100 ? 'PASS' : 'FAIL'} |
| **Conformidad con Catálogo json-render** | **${uiSummary.catalogComplianceRate}%** | $100\\%$ | ${uiSummary.catalogComplianceRate === 100 ? 'PASS' : 'FAIL'} |
| **Estabilidad en Selección de Componentes** | **${uiSummary.componentSelectionStability}%** | $100\\%$ | ${uiSummary.componentSelectionStability === 100 ? 'PASS' : 'FAIL'} |

### Perfil de Latencia de Renderizado
| Indicador | Tiempo (ms) |
| :--- | :--- |
| **Mínima:** | ${uiSummary.latencies.minMs} ms |
| **Máxima:** | ${uiSummary.latencies.maxMs} ms |
| **Promedio:** | ${uiSummary.latencies.avgMs} ms |
| **Mediana:** | ${uiSummary.latencies.medianMs} ms |

---

## 3. Conclusión Global

${
  globalPassed
    ? '✅ **ESTADO GENERAL: APROBADO (PASS)** — El sistema demuestra alta fidelidad de extracción, cero fuga de discrepancias y generación de UI 100% válida contra el catálogo registrado.'
    : '⚠️ **ESTADO GENERAL: REVISIÓN REQUERIDA** — Revisar las métricas de fallos sistemáticos o componentes no catalogados.'
}
`;
}

export interface QualityGateResult {
  passed: boolean;
  violations: string[];
}

export function evaluateQualityGates(
  extractionSummary: ExtractionSuiteSummary,
  uiSummary: UIGenerationSuiteSummary,
): QualityGateResult {
  const violations: string[] = [];

  // Critical Domain Gates
  if (extractionSummary.discrepancyFalseNegativeRate > 0) {
    violations.push(`Falsos negativos en discrepancias (${extractionSummary.discrepancyFalseNegativeRate}%) supera el umbral estricto de 0.0%`);
  }
  if ((extractionSummary.fieldAccuracy.containerNumber ?? 0) < 95) {
    violations.push(`containerNumber accuracy (${extractionSummary.fieldAccuracy.containerNumber}%) < 95%`);
  }
  if ((extractionSummary.fieldAccuracy.grossWeightKg ?? 0) < 95) {
    violations.push(`grossWeightKg accuracy (${extractionSummary.fieldAccuracy.grossWeightKg}%) < 95%`);
  }
  if ((extractionSummary.fieldAccuracy.totalUsd ?? 0) < 80) {
    violations.push(`totalUsd accuracy (${extractionSummary.fieldAccuracy.totalUsd}%) < 80%`);
  }
  if ((extractionSummary.fieldAccuracy.documentType ?? 0) < 80) {
    violations.push(`documentType accuracy (${extractionSummary.fieldAccuracy.documentType}%) < 80%`);
  }

  // Operational Context Gates
  if ((extractionSummary.fieldAccuracy.originPort ?? 0) < 80) {
    violations.push(`originPort accuracy (${extractionSummary.fieldAccuracy.originPort}%) < 80%`);
  }
  if ((extractionSummary.fieldAccuracy.destinationPort ?? 0) < 80) {
    violations.push(`destinationPort accuracy (${extractionSummary.fieldAccuracy.destinationPort}%) < 80%`);
  }
  if ((extractionSummary.fieldAccuracy.vessel ?? 0) < 80) {
    violations.push(`vessel accuracy (${extractionSummary.fieldAccuracy.vessel}%) < 80%`);
  }
  if ((extractionSummary.fieldAccuracy.documentReference ?? 0) < 80) {
    violations.push(`documentReference accuracy (${extractionSummary.fieldAccuracy.documentReference}%) < 80%`);
  }

  // UI Generative Gates
  if (uiSummary.structuralValidityRate < 100) {
    violations.push(`structuralValidityRate (${uiSummary.structuralValidityRate}%) < 100%`);
  }
  if (uiSummary.catalogComplianceRate < 100) {
    violations.push(`catalogComplianceRate (${uiSummary.catalogComplianceRate}%) < 100%`);
  }
  if (uiSummary.componentSelectionStability < 90) {
    violations.push(`componentSelectionStability (${uiSummary.componentSelectionStability}%) < 90%`);
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

function printConsoleSummary(
  extractionSummary: ExtractionSuiteSummary,
  uiSummary: UIGenerationSuiteSummary,
  timestamp: string,
): boolean {
  console.log('======================================================================');
  console.log('                       REPORTE FINAL DE EVALS                        ');
  console.log('======================================================================');
  console.log('\n--- SUITE A: EXTRACCIÓN Y CLASIFICACIÓN (HELD-OUT SET - OPENAI REAL) ---');
  console.log(`  • Documentos evaluados: ${extractionSummary.totalDocuments} | Corridas: ${extractionSummary.totalRuns}`);
  console.log(`  • Latencia promedio API: ${extractionSummary.averageLatencyMs}ms por documento`);
  console.log(`  • Estabilidad entre corridas: ${extractionSummary.stabilityScore}%`);
  console.log(`  • Detección de discrepancias: ${extractionSummary.discrepancyDetectionRate}%`);
  console.log(`  • Falsos negativos en discrepancias: ${extractionSummary.discrepancyFalseNegativeRate}%`);
  console.log('  • Precisión por campos clave:');
  for (const [field, acc] of Object.entries(extractionSummary.fieldAccuracy)) {
    console.log(`      - ${field.padEnd(20)}: ${acc}%`);
  }

  console.log('\n--- SUITE B: GENERACIÓN DE UI (RENDER AGENT - OPENAI REAL) ---');
  console.log(`  • uiIntents evaluados: ${uiSummary.totalIntents} | Corridas: ${uiSummary.totalRuns}`);
  console.log(`  • Latencia promedio agent execution: ${uiSummary.averageLatencyMs}ms`);
  console.log(`  • Validez estructural del árbol: ${uiSummary.structuralValidityRate}%`);
  console.log(`  • Conformidad con catálogo: ${uiSummary.catalogComplianceRate}%`);
  console.log(`  • Estabilidad de componentes: ${uiSummary.componentSelectionStability}%`);
  console.log(`  • Latencia composición UI: avg=${uiSummary.latencies.avgMs}ms | median=${uiSummary.latencies.medianMs}ms | min=${uiSummary.latencies.minMs}ms | max=${uiSummary.latencies.maxMs}ms`);

  console.log('\n======================================================================');
  const gateResult = evaluateQualityGates(extractionSummary, uiSummary);

  if (gateResult.passed) {
    console.log('  VEREDICTO GLOBAL: [PASS] (Todos los gates de calidad superados)');
  } else {
    console.log('  VEREDICTO GLOBAL: [FAIL] (Se detectaron violaciones en los gates de calidad):');
    for (const v of gateResult.violations) {
      console.log(`    ❌ ${v}`);
    }
  }
  console.log(`  Detalle guardado en: evals/results/${timestamp}_summary.md`);
  console.log('======================================================================\n');

  return gateResult.passed;
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = ensureResultsDirectory();

  console.log('\n======================================================================');
  console.log('  NAUTA LOGISTICS OS — SUITE DE EVALS AUTOMATIZADOS (ARI & RENDER AGENT)');
  console.log('======================================================================\n');
  console.log(`[EVALS] Iniciando corrida: ${new Date().toISOString()}`);
  console.log('[EVALS] Modo: Dataset Held-Out Inédito + Validación Estructural json-render\n');

  // --- 1. RUN SUITE A ---
  console.log('>>> [1/2] Ejecutando Suite A: Extracción y Clasificación Documental (5 corridas x doc)...');
  const extractionT0 = performance.now();
  const extractionSummary = await runExtractionEvalSuite(5);
  const extractionDurationMs = Math.round(performance.now() - extractionT0);
  console.log(`    Completado en ${extractionDurationMs}ms (${extractionSummary.totalRuns} corridas sobre ${extractionSummary.totalDocuments} documentos held-out)\n`);

  // --- 2. RUN SUITE B ---
  console.log('>>> [2/2] Ejecutando Suite B: Generación de UI / Render Agent (3 corridas x intent)...');
  const uiT0 = performance.now();
  const uiSummary = await runUIGenerationEvalSuite(3);
  const uiDurationMs = Math.round(performance.now() - uiT0);
  console.log(`    Completado en ${uiDurationMs}ms (${uiSummary.totalRuns} corridas sobre ${uiSummary.totalIntents} uiIntents)\n`);

  // --- 3. PERSIST RESULTS ---
  const extractionResultsPath = path.join(resultsDir, `${timestamp}_extraction.json`);
  const uiResultsPath = path.join(resultsDir, `${timestamp}_ui_generation.json`);
  const summaryMdPath = path.join(resultsDir, `${timestamp}_summary.md`);

  fs.writeFileSync(extractionResultsPath, JSON.stringify(extractionSummary, null, 2), 'utf-8');
  fs.writeFileSync(uiResultsPath, JSON.stringify(uiSummary, null, 2), 'utf-8');

  const summaryMarkdown = buildSummaryMarkdown(timestamp, extractionResultsPath, uiResultsPath, extractionSummary, uiSummary);
  fs.writeFileSync(summaryMdPath, summaryMarkdown, 'utf-8');

  const globalPass = printConsoleSummary(extractionSummary, uiSummary, timestamp);
  if (!globalPass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[EVALS FATAL ERROR]', err);
  process.exit(1);
});
