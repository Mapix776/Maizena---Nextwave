# Nauta Logistics OS

Nauta is an AI-assisted workspace for international logistics operations. Its agent, **Ari**, answers operational questions from Supabase data, reconciles trade documents, renders a contextual UI through `json-render`, and requests human decisions for sensitive cases.

The project is split into a Next.js frontend and a Node.js/Mastra backend connected through Socket.io.

## Live environments

- **Frontend:** [maizena-nextwave.vercel.app](https://maizena-nextwave.vercel.app)
- **Backend API:** [maizena-nextwave.onrender.com](https://maizena-nextwave.onrender.com)
- **Backend health check:** [maizena-nextwave.onrender.com/healthz](https://maizena-nextwave.onrender.com/healthz)

## What it does

- Tracks operations, containers, customs status, ETA risk, alerts, decisions, and parties.
- Answers logistics questions using the operational data stored in Supabase.
- Produces validated `json-render` specifications for cards, timelines, maps, document views, decisions, and charts.
- Reconciles document facts through the Recon subagent.
- Accepts only controlled document-ingestion inputs: Purchase Order, Booking Confirmation, Bill of Lading, Packing List, and Arrival Notice.
- Generates immutable custom report artifacts through the optional E2B/Supabase workflow.

## Architecture

```text
Next.js / React UI
        │ Socket.io
        ▼
Node.js gateway + RunCoordinator
        │
        ▼
Ari (Mastra) ──► Recon subagent / OpenAI
        │
        ▼
Tool registry ──► SupabaseReader / document ingestion
        │
        ▼
Supabase PostgreSQL + private Storage
```

Core implementation folders:

| Area | Location |
| --- | --- |
| Frontend | [`frontend/`](frontend/) |
| Backend gateway and Socket.io | [`backend/src/socket/server.ts`](backend/src/socket/server.ts) |
| Ari and tools | [`backend/src/mastra/`](backend/src/mastra/) |
| Run lifecycle and work trace | [`backend/src/coordinator/`](backend/src/coordinator/) |
| Supabase services | [`backend/src/services/`](backend/src/services/) |
| Report artifact workflow | [`backend/src/artifacts/`](backend/src/artifacts/) |
| Database migrations | [`backend/supabase/migrations/`](backend/supabase/migrations/) |
| QA prompts | [`docs/ari-comprehensive-qa-test-suite.md`](docs/ari-comprehensive-qa-test-suite.md) |

## Requirements

- Node.js 20 or later
- A Supabase project
- An OpenAI API key
- Optional: E2B credentials for custom report generation

## Quick start

Install and run the backend in one terminal:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run dev
```

Install and run the frontend in another terminal:

```powershell
cd frontend
npm ci
$env:NEXT_PUBLIC_BACKEND_URL = 'http://localhost:3001'
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The backend health endpoint is [http://localhost:3001/healthz](http://localhost:3001/healthz).

## Environment variables

Create `backend/.env` from [`backend/.env.example`](backend/.env.example). Keep this file private.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Backend port; defaults to `3001`. |
| `OPENAI_API_KEY` | Yes for Ari | Server-side OpenAI credential. |
| `OPENAI_MAIN_MODEL` | No | Overrides Ari's model. The code defaults to `gpt-4o-mini`. |
| `OPENAI_SMALL_MODEL` | No | Overrides Recon's model. The code defaults to `gpt-4o-mini`. |
| `SUPABASE_URL` | Yes | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only access to Supabase. Never expose it in `NEXT_PUBLIC_*` variables. |
| `SUPABASE_DOCUMENTS_BUCKET` | No | Documents bucket; defaults to `documents`. |
| `SUPABASE_REPORT_ARTIFACTS_BUCKET` | No | Custom report bucket; defaults to `report-artifacts`. |
| `E2B_API_KEY` | Only for reports | Enables the E2B custom-report generation workflow. |
| `E2B_REPORT_TEMPLATE` | Only for reports | E2B template name; defaults to `nauta-report-builder-v1`. |
| `REPORT_GENERATION_MAX_CONCURRENCY` | No | Concurrent report-generation limit, from `1` to `4`; default `1`. |

## Supabase setup

For a fresh Supabase project:

1. Create a private Storage bucket named `documents` for original logistics files.
2. Run the SQL files in [`backend/supabase/migrations/`](backend/supabase/migrations/) in numeric order: `001` through `006`.
3. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `backend/.env`.
4. Restart the backend after changing environment variables.

The schema includes `operations`, `containers`, `documents`, `document_parties`, `document_relationships`, `events`, `decisions`, and `runs`. Migration `006` also creates the private `report-artifacts` bucket plus immutable report-artifact metadata tables.

## Document workflow and safety rules

The ingestion tool requires extracted text or OCR content. It validates the detected document type before any write.

| Accepted type | Typical business reference |
| --- | --- |
| Purchase Order | `PO-...` |
| Booking Confirmation | Booking reference |
| Bill of Lading | B/L reference |
| Packing List | Invoice/Packing List reference |
| Arrival Notice | Arrival notice reference |

Unsupported document types, executables, type relabeling attempts, unreadable uploads, and missing OCR text are rejected without a database write.

Important current behavior:

- The ingestion service persists validated document facts and OCR text in `documents`.
- Original PDF bytes must be placed in the private `documents` bucket through the document-storage flow; the current text-ingestion tool does not upload PDF bytes itself.
- When an operation has no persisted container row, `SupabaseReader` can synthesize a read-only container from verified document facts for the operation detail view.

## API and realtime contracts

### Socket.io

The chat uses Socket.io with WebSocket preferred and polling enabled.

- Client commands: `run:start`, `run:join`.
- Server event: `run:event`.
- Run event types: `run:status`, `ui:replace`, `run:complete`.
- Snapshot events: `incidents:snapshot`, `dashboard:items:snapshot`, `analytics:pinned:snapshot`.

### HTTP endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/healthz`, `/health`, `/` | Health status. |
| `GET` | `/api/analytics` | Aggregated operational metrics. |
| `POST` | `/documents/save` | Stores an Ari-generated JSON document artifact. |
| `POST` | `/api/demo/incidents` | Raises an in-memory demo incident. |
| `POST` | `/api/demo/incidents/:id/acknowledge` | Acknowledges an in-memory demo incident. |
| `POST` | `/api/demo/incidents/reset` | Clears demo incidents. |
| `GET`, `POST`, `PUT` | `/api/analytics/pinned` | Lists, creates, or updates in-memory pinned charts. |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/dashboard/items` | Manages in-memory dashboard items. |
| `POST` | `/api/demo/artifacts/generate` | Generates an accepted custom report artifact. |
| `GET` | `/api/artifacts/:artifactId/revisions/:revisionId/content/*` | Serves an accepted report-artifact file. |

`runs`, demo incidents, dashboard items, pinned charts, and report-request caches are process-local. They reset when the backend restarts.

## Testing

Backend:

```powershell
cd backend
npm run typecheck
npm test
```

Frontend:

```powershell
cd frontend
npm run typecheck
npm run test:work-trace
```

Optional evaluation suite:

```powershell
cd backend
npm run evals
```

Use the [Ari QA suite](docs/ari-comprehensive-qa-test-suite.md) for realistic prompts, failure cases, upload validation, and JSON-render checks.

## Custom report artifacts

The report workflow is optional and requires `E2B_API_KEY`, OpenAI credentials, Supabase, and migration `006`.

```powershell
cd backend
npm run template:e2b
npm run tracer:e2b
```

Generated report revisions are validated before publication, stored under a controlled prefix in private Supabase Storage, and accepted through an idempotent database function.

## Operational limits

- Ari is limited to international logistics and trade-operation queries.
- Database credentials stay on the backend.
- Upload ingestion is the intended data-mutation path. The current Ari code also patches a decision when a user message matches a selected-option phrase; treat that as a known policy gap before production use.
- Analytics and dashboard screens contain demo-oriented, process-local state and should be persisted before production use.

## Additional references

- [Logistics domain guide](docs/dominio-logistica-nauta.md)
- [Research and evaluation notes](docs/evals-research.md)
