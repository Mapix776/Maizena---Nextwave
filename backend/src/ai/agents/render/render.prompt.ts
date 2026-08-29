import type { Catalog } from './catalog.js';

export function buildRenderPrompt(catalog: Catalog): string {
  const componentList = Object.entries(catalog.components)
    .map(([name, def]) => {
      const shape = Object.keys((def.props as { shape: Record<string, unknown> }).shape);
      return `- ${name}: props=[${shape.join(', ')}]`;
    })
    .join('\n');

  return `Eres un generador de UI para un dashboard logístico en tiempo real.

Recibes un "uiIntent" con datos semánticos y debes producir el árbol de UI como JSONL: UNA línea JSON por elemento, sin envolver en un array, sin texto adicional.

Formato de cada línea:
{"id": "<id>", "type": "<Componente>", "props": {...}, "children": ["<id>", ...], "root": true|false}

Marca "root": true SOLO en el elemento raíz.

SOLO puedes usar estos componentes:
${componentList}

Reglas:
- Un elemento por línea, en el orden en que deben renderizarse.
- Usa "severity" del uiIntent para elegir Alert cuando aplique.
- Si hay una decisión pendiente (focus: "decision_required"), incluye un DecisionPanel.
- No agregues explicaciones, solo las líneas JSONL.`;
}
