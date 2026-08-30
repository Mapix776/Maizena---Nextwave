import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { createMainModel } from '../mastra/models.js';
import type { AuthoringWorkspace } from './authoring-runner.js';

const EDITABLE_PATHS = [
  'index.html',
  'src/main.js',
  'src/styles.css',
] as const;

const REPORT_AUTHOR_PROMPT = `Create a polished, completely custom logistics operations report from the sanitized logistics fixture available through reportRead at data/fixture.json.

You must use reportWrite to create exactly these source files:
- index.html
- src/main.js
- src/styles.css

Requirements:
- Build an executive logistics control-tower report, not a generic developer demo.
- Use only facts present in the fixture. Never invent operational values.
- Import the snapshot using the identifier fixture. Include the exact expression \`fixture.operation.reference\` in src/main.js and render that value visibly as text. The report will be rejected without this semantic anchor.
- Make the composition distinctive and information-dense: executive summary, risk focus, container status, route/timeline context, and clear visual hierarchy.
- Establish an intentional visual system in :root with at least ten CSS design tokens covering canvas, surface, text, muted text, accent, ok, warning, critical, spacing, and radius. Set an explicit system font stack on body, use at least four type sizes, keep the main heading pane-appropriate, and use tabular numerals for operational metrics.
- Format every quantity, currency value, and date with explicit reusable Intl.NumberFormat and Intl.DateTimeFormat instances. Never expose fixture enum keys such as CUSTOMS_HOLD: map them to human-readable labels and semantic status chips.
- Render semantic regions marked data-report-hero, data-kpi-grid, data-risk-board, data-container-matrix, data-route-timeline, data-decision-panel, and data-report-visual. The KPI region must contain at least four compact metrics with value-first hierarchy. Show every fixture container, risk, route milestone, and pending decision without paragraph dumps.
- Include at least one data-derived inline SVG visualization with three or more visible shapes, such as a status distribution, risk bars, or route timeline. It must use only fixture values.
- Use semantic accessible HTML, a bounded max-width, responsive CSS grid, and at least one media query. At 390px the report must not scroll horizontally.
- The browser validator measures computed styles, not just CSS declarations. Visible report text must resolve to at least four distinct computed font sizes, and visible surfaces must resolve to at least three distinct opaque background colors on both desktop and mobile.
- Include a defensive mobile reset that applies box-sizing: border-box, min-width: 0, max-width: 100%, and overflow-wrap: anywhere to report descendants. Remove fixed/min-content widths at the mobile breakpoint and keep html, body, tables, SVGs, grids, and [data-report-root] within the 390px viewport.
- Art-direct the page around one strong visual concept: use a confident hero, layered surfaces, deliberate asymmetry, purposeful whitespace, and a clear reading path. Avoid a plain white document, five equal-height columns, raw bullet-list sections, oversized headings, or squeezing operational tables into narrow cards. Dense tables or matrices must receive enough width to remain scannable.
- Ari visual language is the default only when the user has not requested a visual style. Its reference anchors are a calm #fbf9ff canvas, white surfaces, deep-plum #211d38 text, restrained #ba46d6 accents, #f1eafd lavender fills, #eee9fa soft borders, compact Inter/system typography, 12–18px corner radii, small uppercase eyebrows, and sparing pink-to-violet gradients. Express that language freshly for the report instead of copying a fixed template.
- Any explicit user-requested visual style, palette, brand, era, or medium overrides the Ari visual language completely. Follow that art direction with substantial creative freedom while preserving factual accuracy, information completeness, accessibility, responsiveness, isolation, and the measurable quality gates. Do not blend in the Ari palette, gradients, or rounded-card language unless the user asks for Ari styling or a hybrid.
- Vary composition and visualization type to fit the data, and vary the palette within the active art direction: the explicit user style when present, otherwise Ari. These requirements measure visual quality; they do not prescribe section order or a reusable template.
- index.html must contain a non-empty title, a [data-report-root] element, and load the local src/main.js as a module.
- src/main.js must render from the imported ../data/fixture.json snapshot and set document.body.dataset.reportReady = "true" after rendering.
- No external URLs, remote fonts, remote images, fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, dynamic import, or runtime package installation.
- Reports are static, presentation-only artifacts. Do not create buttons, filters, toggles, tabs, or other interactive controls.
- Never emit HTML event-handler attributes such as onclick, onchange, onload, or any other whitespace-prefixed on...= pattern anywhere in index.html, JavaScript strings, or templates. The source validator rejects that capability. Render all useful information visibly without interaction.
- Do not write package files, build scripts, output files, or any path other than the three editable paths.

Use reportList and reportRead to inspect the workspace and fixture, then write all three files. Keep the final textual response to one short sentence.`;

export function createReportAuthoringTools(
  workspace: AuthoringWorkspace,
  onWrite?: (path: string) => void,
) {
  return {
    reportList: createTool({
      id: 'report-list',
      description: 'List the logical files available in the isolated report workspace.',
      inputSchema: z.object({}),
      outputSchema: z.object({ paths: z.array(z.string()) }),
      execute: async () => ({ paths: await workspace.list() }),
    }),
    reportRead: createTool({
      id: 'report-read',
      description: 'Read one logical report source file or the sanitized fixture.',
      inputSchema: z.object({ path: z.string().min(1).max(80) }),
      outputSchema: z.object({ path: z.string(), contents: z.string() }),
      execute: async ({ path }) => ({
        path,
        contents: await workspace.read(path),
      }),
    }),
    reportWrite: createTool({
      id: 'report-write',
      description: 'Create or replace one allowlisted logical report source file.',
      inputSchema: z.object({
        path: z.enum(EDITABLE_PATHS),
        contents: z.string().max(160_000),
      }),
      outputSchema: z.object({
        path: z.string(),
        bytes: z.number().int().nonnegative(),
      }),
      execute: async ({ path, contents }) => {
        await workspace.write(path, contents);
        onWrite?.(path);
        return { path, bytes: Buffer.byteLength(contents) };
      },
    }),
  };
}

type ReportAuthoringTools = ReturnType<typeof createReportAuthoringTools>;

interface ReportAuthorAgent {
  generate(
    messages: Array<{ role: 'user'; content: string }>,
  ): Promise<{ text: string }>;
}

export function reportAuthorModelId(
  env: Partial<Record<
    'OPENAI_REPORT_MODEL' | 'OPENAI_MODEL_REASONING' | 'OPENAI_MAIN_MODEL',
    string
  >> = process.env,
) {
  return env.OPENAI_REPORT_MODEL
    ?? env.OPENAI_MODEL_REASONING
    ?? env.OPENAI_MAIN_MODEL;
}

export interface ReportAuthorOptions {
  createAgent?: (tools: ReportAuthoringTools) => ReportAuthorAgent;
  feedback?: string;
  userPrompt?: string;
}

function createDefaultAgent(tools: ReportAuthoringTools): ReportAuthorAgent {
  const agent = new Agent({
    id: 'ari-custom-report-author',
    name: 'Ari Custom Report Author',
    instructions:
      'You are Ari\'s isolated report-authoring worker. Operate only through the supplied logical report tools and follow the user specification exactly.',
    model: createMainModel(reportAuthorModelId()),
    tools,
  });

  return {
    async generate(messages) {
      const result = await agent.generate(messages, { maxSteps: 12 });
      return { text: result.text };
    },
  };
}

export async function authorCustomReport(
  workspace: AuthoringWorkspace,
  options: ReportAuthorOptions = {},
) {
  const userPrompt = options.userPrompt?.trim();
  if (options.userPrompt !== undefined && (!userPrompt || userPrompt.length > 1_200)) {
    throw new Error('Report request must be between 1 and 1200 characters');
  }
  const writtenPaths = new Set<string>();
  const tools = createReportAuthoringTools(workspace, (path) => writtenPaths.add(path));
  const agent = options.createAgent?.(tools) ?? createDefaultAgent(tools);
  const requestedReport = userPrompt
    ? `${REPORT_AUTHOR_PROMPT}\n\nUser-requested report brief:\n${userPrompt}\n\nFollow requested facts and operational emphasis only where supported by the fixture. Follow explicit visual and art direction even though style is not fixture data; it overrides Ari's default visual language.`
    : REPORT_AUTHOR_PROMPT;
  const repairPrompt = options.feedback
    ? `${requestedReport}\n\nThe previous fixed validation attempt failed. Inspect the current files, correct the problem, and rewrite all three required files. Bounded validator diagnostic:\n${options.feedback.slice(0, 8_000)}`
    : requestedReport;
  const result = await agent.generate([
    { role: 'user', content: repairPrompt },
  ]);

  for (const path of EDITABLE_PATHS) {
    if (!writtenPaths.has(path)) {
      throw new Error(`AI author did not create required source file: ${path}`);
    }
    try {
      const contents = await workspace.read(path);
      if (!contents.trim()) throw new Error('empty');
    } catch {
      throw new Error(`AI author did not create required source file: ${path}`);
    }
  }

  return {
    summary: result.text.trim() || 'Custom report authored.',
    writtenPaths: [...writtenPaths].sort(),
  };
}
