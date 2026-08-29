import { eventBus } from '../../../bus/eventBus.js';
import { BUS_EVENTS } from '../../../bus/events.js';
import { env } from '../../../config/env.js';
import type { UIIntent } from '../../../types/agent.contract.js';

/**
 * Consume el stream SSE nativo de OpenAI y reenvía los chunks al bus.
 * El WS los entrega al browser en tiempo real.
 *
 * Activar con: import { streamSpec } from './render.agent.js'
 */
export async function streamSpec(
  runId: string,
  uiIntent: UIIntent,
  openai: import('openai').OpenAI,
  model = env.OPENAI_MODEL_FAST
): Promise<Record<string, unknown>> {
  const stream = await openai.chat.completions.create({
    model,
    stream: true,
    messages: [
      {
        role: 'system',
        content: 'Genera un JSON válido con la estructura de JsonRenderSpec para visualizar la operación logística descrita.',
      },
      {
        role: 'user',
        content: JSON.stringify(uiIntent),
      },
    ],
    response_format: { type: 'json_object' },
  });

  let buffer = '';

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    buffer += delta;

    // Chunk crudo al bus → WS lo envía al browser en tiempo real
    eventBus.emit(BUS_EVENTS.RUN_UPDATED(runId), {
      type: 'ui.chunk',
      runId,
      delta,
    });
  }

  // JSON completo al cerrar el stream
  const spec = JSON.parse(buffer) as Record<string, unknown>;
  eventBus.emit(BUS_EVENTS.RUN_UPDATED(runId), {
    type: 'ui.spec',
    runId,
    spec,
  });

  return spec;
}
