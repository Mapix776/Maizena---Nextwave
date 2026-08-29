// Esto es lo que el agente de FRONT devuelve. El backend solo lo transporta.

export interface JsonRenderSpec {
  root: string;
  elements: Record<string, {
    type: string;
    props: Record<string, unknown>;
    children?: string[];
  }>;
}

// Patch incremental (streaming JSONL) — cada línea que reenvías por SSE tal cual
export interface JsonRenderPatch {
  op: 'add' | 'update' | 'remove';
  elementId: string;
  element?: JsonRenderSpec['elements'][string];
}
