# DBA Agent Studio

A local-first database-design website implementing the six-stage workflow in `../dba_agent_project.pdf`. The client can inspect each stage's output before continuing. No GitHub push or Vercel deployment is required or performed.

## Start locally

Requirements: Node.js 22.12+ (Node 24 LTS recommended), npm, and a modern browser. Development and production servers bind to **127.0.0.1**, not the public network.

```powershell
cd D:\project2\project_code
npm install
npm run dev
```

Open **http://127.0.0.1:3000**. The offline example works immediately without an API key, Docker, or an external database. Fonts and diagrams are bundled locally.

Production:

```powershell
npm run build
npm start
```

## Live model/provider configuration

The offline example is a **labelled deterministic fixture**, not an LLM pretending to understand an arbitrary brief. For your own system, configure a live provider in **Settings & providers**, then create a new design workspace. Providers must support the OpenAI-compatible `/chat/completions` API and `response_format: {type: "json_object"}`. Supported configurations include compatible gateways (such as GapGPT/OpenRouter), a custom compatible provider, and Ollama's compatible endpoint.

The browser can supply a temporary key; it stays in React memory and clears on refresh. For persistent server configuration, copy `.env.example` to `.env.local` and edit it:

```dotenv
LLM_PROVIDER=compatible
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=your-provider-model-id
LLM_API_KEY=your-secret-key
LLM_MAX_ATTEMPTS=3
LLM_TIMEOUT_MS=90000
```

For Ollama, use `LLM_PROVIDER=ollama`, `LLM_BASE_URL=http://localhost:11434/v1`, and the exact model ID installed in Ollama. Ensure that model supports the required JSON output. Ollama must run on the same machine as this app's server. Remote providers require HTTPS; local HTTP is allowed only for loopback endpoints. Never enter a provider login/session cookie as an API key.

Restart Next.js after environment changes. UI configuration is saved in browser local storage (no API key); session provider/model/base URL are saved with each workspace. The same-mode configuration can be changed for an existing workspace. Switching between offline/live modes creates a new workspace to preserve provenance. Changing a DBMS happens through a design revision, not a provider setting.

## The workflow

| Stage | Input | Visible output / gate |
| --- | --- | --- |
| 1. System intake | Natural-language brief | Structured actors, entities, processes, risks; `intake.md` |
| 2. Interview | Seven-category questions and user answers | At least one adaptive follow-up; model decides when sufficient; `requirements.md` |
| 3. DBMS choice | Consolidated requirements | PostgreSQL/MySQL/SQLite/SQL Server comparison, rationale and rejection reasons; `dbms-choice.md` |
| 4. Documentation | Requirements + DBMS | `conceptual-model.md`, `logical-schema.md`, `normalization.md`, `assumptions.md`, `design.json`; live Mermaid ER map |
| 5. Revision & approval | Natural-language changes | Regenerates all affected documents, records `changelog.md`, invalidates prior approval/SQL; explicit approval is mandatory |
| 6. SQL & validation | Explicitly approved model | `schema.sql`, `seed.sql`, `validation.md`; complete ZIP export |

All artifacts remain inspectable in the stage output panel and Artifacts tab. Continue buttons keep the client in control instead of skipping past results. Prompt library shows the actual server prompt files. Activity shows full inputs/outputs, timings, provider/model, success/failure, and attempt counts. Interview drafts survive page reloads. Sessions resume from their saved URL or dashboard.

### Try a complete example

1. Click **Explore an example** on the dashboard.
2. Run intake; open `intake.md` and continue to the interview.
3. Click **Fill example answers**, submit, and do the same for the adaptive follow-up.
4. Compare DBMS options, then generate and inspect all design documents and the relationship map.
5. Request **Add an optional phone number to members** or **Switch to SQLite**. Inspect the updated files and version history.
6. Explicitly approve the design, generate/validate SQL, and download the full bundle.

Offline revisions deliberately support phone addition and the four DBMS switches only. Unsupported changes produce an explanatory error. Live mode supports arbitrary natural-language revisions through the configured model.

The supplied PDF references a separate `scenario.md`, but **that file was not provided**. `examples/lumina/` is a complete illustrative coworking run, not a claim to reproduce the missing scenario. It includes meaningful junction rows, an optional FK with both null and populated values, multiple lifecycle states, boundary amounts, and a revision. Regenerate it:

```powershell
npm run example
```

That command executes PostgreSQL validation, writes a resumable local workspace, and refreshes the example files. Its offline traces are clearly identified as fixtures, not real LLM calls.

## SQL guarantees and boundaries

- One typed canonical model produces every document, diagram and SQL file. The compiler handles dialect types, Unicode/string escaping, composite keys, FK deletion actions, constraints, dependency ordering, indexes and seeded values.
- PostgreSQL executes in a disposable **PGlite PostgreSQL** instance. SQLite executes in a disposable **sql.js SQLite** instance with foreign keys enabled and integrity/FK checks. Both verify exact row counts for every table.
- MySQL/MariaDB and SQL Server exports receive **structural checks only**, not simulated execution. The UI/export report explicitly says so. Test them against your actual engine before using them. MySQL requires 8.0.16+ for enforced CHECKs; use a compatible modern MariaDB release if substituting it.
- Failed real validation can request up to **three validation attempts**, with bounded, logged provider retries. A repaired canonical design invalidates approval. Review and approve the changed version before SQL can be exported.
- Run `schema.sql`, then `seed.sql`, in a **new existing empty database**. Scripts do not drop databases, disable integrity, create privileged users or contact production servers. IDs are application-assigned, not auto-incremented.
- Seed data covers every table (at least three rows) with meaningful synthetic values. Seeds are intended for one initial run, not repeated insertion into an already-seeded database.
- Structural checks and successful execution do not mathematically prove 3NF, completeness, security, performance, or concurrency correctness. Read the normalization/business-rule notes. Cross-row booking overlap, authorization, retention jobs, plan immutability, and payments need real application/transaction enforcement. The SQL does not falsely claim to implement those with row CHECKs.
- The deliberately bounded compiler rejects cyclic inter-table FKs and unsafe/unsupported CHECK functions. Maximum 30 tables, 50 columns/table, and 30 seed rows/table. Complex vendor-specific features/triggers, partial indexes, sequences, stored procedures and row-level security are not synthesized. Request a supported normalized alternative or extend the compiler deliberately.

## Persistence and private data

Default paths are `data/<uuid>.json` and `outputs/<uuid>/`. They are gitignored. `DATA_DIR` and `OUTPUT_DIR` can override these paths. Output folders include current artifacts, `session.json`, and `llm-calls.json`; stale SQL is removed after a revision. JSON state is atomically replaced; local operations are serialized and stale browser versions are rejected.

Back up the data/output directories. This is a private single-user studio, not a multi-tenant SaaS with user accounts. Files and browser drafts are not encrypted by the application. Full trace/export files contain system briefs and interview answers; share deliberately. API keys are not saved or sent to the client by the server, and are redacted from logs. Configure access protection before exposing the service.

## Future Vercel hosting — not deployed

1. Use this directory as the project root and Next.js as the framework.
2. Set `APP_ACCESS_TOKEN` to a strong secret and enter it in Settings. Hosting without that token is blocked on Vercel.
3. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for durable REST Redis persistence. Sessions, artifacts and traces then live remotely; download ZIP to obtain physical files. Distributed Redis leases prevent overlapping writes.
4. Configure provider environment variables. Do not point a hosted server at your laptop's localhost Ollama.
5. Set a platform execution-time budget sufficient for model latency, retry limits, and embedded validation. Route handlers request up to 300 seconds; plan/account limits can be lower.
6. Run the full checks against the hosted preview before production. No hosting behavior has been verified here. Filesystem-only storage on Vercel is `/tmp` and **ephemeral**, not durable.

The optional Redis adapter is implemented but not integration-tested without Redis credentials. Long-running/large designs may need an asynchronous worker and durable job queue at scale.

## Validation commands

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Google Chrome by default. Set `CHROME_PATH` to your Chromium executable on another machine. Playwright reuses a local production server on port 3000, or starts one after a build. Tests cover the complete UI flow, diagram rendering, ZIP content, reload/resume, mobile overflow, trace/prompt/settings pages, API ordering/conflicts/origin checks, and production API validation. Unit/integration tests cover real PostgreSQL/SQLite, four dialects, structural invariants, revision propagation, persistence, provider retries/redaction, and automatic repair/reapproval. Mock-provider tests exercise the real adapter without claiming remote model quality.

## Repository map

```text
src/app/           Next.js page, layout, CSS and protected API routes
src/components/    Client studio, Markdown and Mermaid rendering
src/lib/           Typed model, workflow, provider, compiler, artifacts, state, validation
prompts/           Editable separated stage prompts and canonical JSON contract
tests/             Unit/provider/workflow tests and browser/API acceptance tests
scripts/example.ts Reproducible end-to-end illustrative run
examples/lumina/   Complete generated example output
docs/              Architecture, critique and compliance reports
```

Development journal and final acceptance audit are outside the app at `../PROJECT_LOG.md` and `../PDF_COMPLIANCE_AUDIT.md`. A local Git repository is initialized; no commit, remote, GitHub push, or deployment is performed.
