# Ubiquitous Language — Nauta

Rendered from `terms.json`. Accepted terms bind all future work; drafts are pending user confirmation; deprecated terms stay visible for recognition.

## Accepted

- **engine tracer** — the first vertical slice, user-defined: the full setup where the AI returns a hello world through one deterministic tool that always returns the same result — Mastra agent → RunCoordinator → Socket.IO → json-render in the Next frontend. Everything else extends from this base.
- **Order incident** — a manually raised, actionable order problem containing an order ID, type, severity, and message; the backend owns its identity, time, and global acknowledgment state. It remains actionable until acknowledged and is not an agent Run incident.
- **Work trace** — a run-scoped, user-visible account of Ari's observable work. It can progress live through safe animated summaries and settles into an elapsed-time disclosure when complete. It is not raw hidden chain-of-thought, inferred component narration, infrastructure logs, raw tool identity, or payload dumps.

## Draft (from the spec, pending brief validation)

- **Ari** — supervisor AI logistics operator (Mastra). Reasons, delegates, selects registered tools, returns a typed `StepResult`. Never owns run state, never manufactures facts.
- **Run** — one execution of a `FlowDefinition` for a scenario; canonical state is `RunState`; clients subscribe to Socket.IO room `run:{runId}`.
- **FlowDefinition** — versioned JSON flow-as-data with an allowlisted capability vocabulary; executed step-by-step by the FlowRunner, never hard-coded as a graph.
- **RunCoordinator** — deterministic application harness: run lifecycle, per-run mutex, StepResult validation, UI regeneration, ordered event emission. The LLM never performs these duties.
- **StepResult** — typed envelope every capability returns; Zod-validated before any `RunState` mutation; invalid output fails the step and preserves the last valid UI.
- **UIEnvelope** — full catalog-validated json-render tree sent via `ui:replace`; the UI is a disposable projection, never a source of truth. *Not* the old incremental `JsonRenderPatch` protocol.
- **Facts vs Findings** — facts: canonical tool-produced data; findings: evidence-backed interpretations referencing evidence IDs. Separate from messages (Mastra memory) and UI (projection).

## Deprecated

- **recon** — legacy agent name from the pre-spec repo contract (`'ari' | 'recon'`). Replaced by the spec's report specialist.
