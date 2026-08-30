# Decision Log — maizena

NextWave Hackathon 2026 · Bogotá

## 1. How the agent generates the UI  `T+23:03`

**Options considered**

- Free-form HTML generated directly by the LLM
- Fixed screens built for every known scenario
- A schema-validated JSON UI composed from registered components

**Chosen:** A schema-validated JSON UI rendered from a component catalog.

**Why:** The interface can adapt to new flow states without allowing arbitrary, unsafe, or visually inconsistent output. The catalog validates component types and props before rendering.

## 2. How to balance flexibility and visual consistency  `T+23:03`

**Options considered**

- Build every screen manually
- Use only generic AI/chat components
- Combine domain-specific pre-fab components with AI Elements components

**Chosen:** Combine logistics components with AI Elements components.

**Why:** Logistics cards, maps, timelines, alerts, and decision panels provide trusted operational patterns. Conversation, message, prompt-input, attachment, and suggestion components keep the agent interaction natural and reusable.

## 3. How UI content is produced  `T+23:03`

**Options considered**

- Let the LLM invent raw presentation data
- Send raw database objects directly to the frontend
- Compose the UI from validated run facts

**Chosen:** Compose the UI from validated run facts.

**Why:** The UI composer validates each fact with schemas before it becomes a component. This protects data quality while still letting the UI change as the flow changes.

## 4. How the interface updates while Ari is working  `T+23:04`

**Options considered**

- Refresh when the run finishes
- Poll the backend at intervals
- Stream run events through a persistent connection

**Chosen:** Stream real-time run events through Socket.IO.

**Why:** The audience can see the interface change during a run. Persistent events make state, progress, and generated components visible without a manual refresh.

## 5. How to reduce perceived latency  `T+23:05`

**Options considered**

- Wait for every state to be generated after it happens
- Pre-render every possible state
- Pre-generate only probable next states and use the result on a cache hit

**Chosen:** Speculative pre-generation for probable next states.

**Why:** This improves responsiveness without committing to every branch in advance. The system can serve a validated predicted UI immediately when the next state matches.
