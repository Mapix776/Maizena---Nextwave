# Agent Guidance

Use the installed Wall-I skills for structured workflow:

- wall-i-init
- wall-i-map
- wall-i-plan
- wall-i-grill
- wall-i-research
- wall-i-design
- wall-i-execute
- wall-i-tdd
- wall-i-review
- wall-i-handoff

Keep Wall-I artifacts in .wall-i/. After the PRD in .wall-i/runs/<task-id>/prd.md is approved, run wall-i-execute for implementation.
Use the current runtime's available execution and delegation capabilities. Verify completion from repository artifacts, diffs, and configured gates.

## Execution Routing

Wall-I owns methodology, repository artifacts, gates, and review policy. The
active runtime owns sessions, execution, delegation, isolation, and messaging.
Do not persist runtime-specific identifiers or commands in Wall-I artifacts.

### Route By Capability

- Keep ambiguous decisions, planning, and final verdicts with the coordinator.
- Delegate fully specified, isolated work when a fresh context improves focus.
- Require visual interaction only when the verification surface needs it.
- Parallelize only dependency-independent work without shared mutable state.
- Prefer direct execution for small, ordered, reversible changes.
- Resolve available capabilities at runtime; never hard-code product or model
  names in repository guidance.

### Delegation Contract

- Give each worker a self-contained prompt: goal, reason, exact inputs, write
  scope, contracts, gates, done-when evidence, stop conditions, and explicit
  prohibitions.
- Bind editing work to the intended checkout. Create isolated workspaces only
  when parallel changes or risk justify them.
- Use host-provided messaging for questions and blockers, not as proof of
  completion.
- Verify repository artifacts, diff, and gates. Never accept a worker summary as
  proof.
- For fresh review, prevent access to the implementer's conclusions; provide the
  specification, exact change snapshot, and gate evidence. Prefer a reviewer
  from a different model family than the implementer when families are known.

### Portability Contract

- Keep canonical vocabulary, decisions, design contracts, prompts, and review
  bundles in the repository.
- Keep transient session IDs, runtime logs, and host coordination state in the
  active runtime.
- If delegation is unavailable, execute the same prompt contract in the current
  context.
- Keep one scheduler responsible for issue order, retries, and status.
