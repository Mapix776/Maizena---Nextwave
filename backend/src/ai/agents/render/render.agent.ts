import { openai } from '../../openai-client/client.js';
import { catalog } from './catalog.js';
import { buildRenderPrompt } from './render.prompt.js';
import type { UIIntent } from '../../../types/agent.contract.js';
import type { JsonRenderSpec } from '../../../types/render.contract.js';
import { eventBus } from '../../../bus/eventBus.js';
import { BUS_EVENTS } from '../../../bus/events.js';
import { env } from '../../../config/env.js';

interface JsonlLine {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  root?: boolean;
}

/**
 * Consume el stream SSE de OpenAI, parsea JSONL incremental y
 * emite ui.patch por cada elemento apenas lo procesa.
 * Al finalizar emite ui.spec como snapshot completo.
 */
export async function streamSpec(runId: string, uiIntent: UIIntent): Promise<JsonRenderSpec> {
  const stream = await openai.chat.completions.create({
    model: env.OPENAI_MODEL_FAST ?? 'gpt-4o-mini',
    stream: true,
    messages: [
      { role: 'system', content: buildRenderPrompt(catalog) },
      { role: 'user', content: JSON.stringify(uiIntent) },
    ],
  });

  const spec: JsonRenderSpec = { root: '', elements: {} };
  let lineBuffer = '';

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    lineBuffer += delta;

    // Parsear líneas completas conforme llegan
    let newlineIdx: number;
    while ((newlineIdx = lineBuffer.indexOf('\n')) !== -1) {
      const rawLine = lineBuffer.slice(0, newlineIdx).trim();
      lineBuffer = lineBuffer.slice(newlineIdx + 1);
      if (!rawLine) continue;

      try {
        const line: JsonlLine = JSON.parse(rawLine);

        // Validar que el componente exista en el catalog
        if (!(line.type in catalog.components)) continue;

        spec.elements[line.id] = {
          type: line.type,
          props: line.props,
          children: line.children ?? [],
        };
        if (line.root) spec.root = line.id;

        // Patch incremental al bus — el WS lo entrega al browser al instante
        eventBus.emit(BUS_EVENTS.RUN_UPDATED(runId), {
          type: 'ui.patch',
          runId,
          patch: { op: 'add', elementId: line.id, element: spec.elements[line.id] },
        });
      } catch {
        // Línea incompleta o inválida — se descarta silenciosamente
      }
    }
  }

  // Spec completo al final (snapshot para clientes que se conecten tarde)
  eventBus.emit(BUS_EVENTS.RUN_UPDATED(runId), { type: 'ui.spec', runId, spec });
  return spec;
}
