import { openai } from '@ai-sdk/openai';
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
} from '@ai-sdk/provider';

const EMPTY_USAGE = {
  inputTokens: {
    total: 0,
    noCache: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 0,
    text: 0,
    reasoning: 0,
  },
};

export class DeterministicRenderModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'nauta-tracer';
  readonly modelId = 'deterministic-render-v1';
  readonly supportedUrls = {};

  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    const hasToolResult = options.prompt.some(
      (message) =>
        message.role === 'tool' ||
        (Array.isArray(message.content) &&
          message.content.some((part) => part.type === 'tool-result')),
    );

    if (!hasToolResult) {
      return {
        content: [
          {
            type: 'tool-call',
            toolCallId: 'render-demo-tool-call',
            toolName: 'renderDemoTool',
            input: JSON.stringify({
              assistantResponse: 'I can help with that.',
            }),
          },
        ],
        finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
        usage: EMPTY_USAGE,
        warnings: [],
      };
    }

    return {
      content: [{ type: 'text', text: 'Render demo tool completed.' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: EMPTY_USAGE,
      warnings: [],
    };
  }

  async doStream(): Promise<never> {
    throw new Error('The deterministic render model supports generate() only.');
  }
}

export function createProductionModel(modelId = process.env.OPENAI_MODEL ?? 'gpt-5-mini') {
  return openai(modelId);
}
