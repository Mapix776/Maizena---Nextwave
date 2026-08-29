import { z } from 'zod';

/**
 * Catálogo de componentes disponibles para el agente de render.
 * Define los props válidos de cada componente — se inyectan en el system prompt.
 */
export const catalog = {
  components: {
    Card: {
      props: z.object({ title: z.string(), subtitle: z.string().nullable() }),
      hasChildren: true,
    },
    Alert: {
      props: z.object({
        severity: z.enum(['normal', 'warning', 'critical']),
        message: z.string(),
      }),
    },
    Timeline: {
      props: z.object({
        steps: z.array(
          z.object({ label: z.string(), status: z.enum(['done', 'active', 'pending']) })
        ),
      }),
    },
    Map: {
      props: z.object({
        route: z.array(z.tuple([z.number(), z.number()])),
        markers: z.array(z.object({ lat: z.number(), lng: z.number(), label: z.string() })),
      }),
    },
    DecisionPanel: {
      props: z.object({
        question: z.string(),
        options: z.array(z.object({ id: z.string(), label: z.string() })),
      }),
    },
  },
  actions: {
    submitDecision: { params: z.object({ optionId: z.string() }) },
  },
} as const;

export type Catalog = typeof catalog;
