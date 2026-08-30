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
- Use semantic accessible HTML and responsive CSS.
- index.html must contain a non-empty title, a [data-report-root] element, and load the local src/main.js as a module.
- src/main.js must render from the imported ../data/fixture.json snapshot and set document.body.dataset.reportReady = "true" after rendering.
- No external URLs, remote fonts, remote images, fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, dynamic import, or runtime package installation.
- Do not use inline event-handler attributes. Local JavaScript interactions are allowed.
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

export interface ReportAuthorOptions {
  createAgent?: (tools: ReportAuthoringTools) => ReportAuthorAgent;
  feedback?: string;
}

function createDefaultAgent(tools: ReportAuthoringTools): ReportAuthorAgent {
  const agent = new Agent({
    id: 'ari-custom-report-author',
    name: 'Ari Custom Report Author',
    instructions:
      'You are Ari\'s isolated report-authoring worker. Operate only through the supplied logical report tools and follow the user specification exactly.',
    model: createMainModel(),
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
  const writtenPaths = new Set<string>();
  const tools = createReportAuthoringTools(workspace, (path) => writtenPaths.add(path));
  const agent = options.createAgent?.(tools) ?? createDefaultAgent(tools);
  const repairPrompt = options.feedback
    ? `${REPORT_AUTHOR_PROMPT}\n\nThe previous fixed validation attempt failed. Inspect the current files, correct the problem, and rewrite all three required files. Bounded validator diagnostic:\n${options.feedback.slice(0, 8_000)}`
    : REPORT_AUTHOR_PROMPT;
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
