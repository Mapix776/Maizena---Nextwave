import {
  defineCatalog,
  defineSchema,
  type Spec,
  validateSpec,
} from '@json-render/core';
import { z } from 'zod';

// Mirrors @json-render/react/schema without importing the React package on the
// server. This is the shared grammar used by both copies of the tracer catalog.
const reactSpecSchema = defineSchema((schema) => ({
  spec: schema.object({
    root: schema.string(),
    elements: schema.record(
      schema.object({
        type: schema.ref('catalog.components'),
        props: schema.propsOf('catalog.components'),
        children: schema.array(schema.string()),
      }),
    ),
  }),
  catalog: schema.object({
    components: schema.map({
      props: schema.zod(),
      slots: schema.array(schema.string()),
      description: schema.string(),
    }),
  }),
}));

export const tracerCatalog = defineCatalog(reactSpecSchema, {
  components: {
    Stack: {
      props: z.object({ gap: z.enum(['sm', 'md', 'lg']) }).strict(),
      slots: ['default'],
      description: 'A vertical layout for tracer content.',
    },
    Heading: {
      props: z.object({ text: z.string().min(1) }).strict(),
      slots: [],
      description: 'A prominent heading.',
    },
    Text: {
      props: z
        .object({
          text: z.string().min(1),
          tone: z.enum(['default', 'success']),
        })
        .strict(),
      slots: [],
      description: 'A line of run-generated text.',
    },
  },
});

export type TracerSpec = typeof tracerCatalog._specType;

export function validateTracerSpec(spec: unknown): TracerSpec {
  const validation = tracerCatalog.validate(spec);

  if (!validation.success || !validation.data) {
    throw new Error('Invalid json-render tree', { cause: validation.error });
  }

  const structure = validateSpec(validation.data as Spec);

  if (!structure.valid) {
    throw new Error(
      `Structurally invalid json-render tree: ${structure.issues
        .map(({ message }) => message)
        .join(' ')}`,
    );
  }

  for (const element of Object.values(validation.data.elements)) {
    const componentName = element.type as keyof typeof tracerCatalog.data.components;
    const component = tracerCatalog.data.components[componentName];
    const props = component.props.safeParse(element.props);

    if (!props.success) {
      throw new Error(`Invalid props for json-render component ${element.type}`, {
        cause: props.error,
      });
    }
  }

  return validation.data;
}

export interface UIEnvelope<TPayload = unknown> {
  runId: string;
  sequence: number;
  type: 'run:status' | 'ui:replace' | 'run:complete';
  timestamp: string;
  payload: TPayload;
}

export interface RunSnapshot {
  runId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  sequence: number;
  facts: Record<string, unknown>;
  ui: TracerSpec | null;
  error?: string;
}
