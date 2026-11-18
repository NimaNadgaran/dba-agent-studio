# DBA Agent Studio

A local-first, LLM-powered database-design studio with adaptive interviews, relational DBMS comparison, consistent design documents and diagrams, iterative revisions, and validated SQL exports. It implements the six-stage course assignment; the original PDF is kept locally outside this repository.

Public repository: [NimaNadgaran/dba-agent-studio](https://github.com/NimaNadgaran/dba-agent-studio). The first commit preserves the offline baseline with the message `first sprint with no real api agent`. No hosting deployment is performed.

## Start locally

Requirements: Node.js 22.12+ (Node 24 LTS recommended), npm, and a modern browser. Development and production servers bind to **127.0.0.1**, not the public network.

```powershell
cd project_code
npm install
npm run dev
```

Open **http://127.0.0.1:3000**. The offline example works immediately without an API key, Docker, or an external database. Fonts and diagrams are bundled locally.

Production:

```powershell
npm run build
npm start
```

## Live providers and personal API keys

Presets are based on the teacher's [awesome-free-llm-apis list](https://github.com/mnfst/awesome-free-llm-apis), checked on November 13, 2026. That repository lists services, **not personal credentials**. No real keys are included in source, examples or Git history. Free access, quotas, model availability, region eligibility and data-use policies are controlled by each provider and can change.

| Preset | API base URL | Key setup |
| --- | --- | --- |
| Kilo Gateway | `https://ai-gateway.kilo.ai/api/v1` | Anonymous free access; leave key blank. Default `kilo-auto/free`. |
| Groq | `https://api.groq.com/openai/v1` | Get your own key at [Groq Console](https://console.groq.com/keys); optional server variable `GROQ_API_KEY`. |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | Get your own key at [AI Studio](https://aistudio.google.com/apikey); optional `GEMINI_API_KEY`. Load available models and check free-tier eligibility. |
| OpenRouter | `https://openrouter.ai/api/v1` | Get your own key at [OpenRouter](https://openrouter.ai/settings/keys); optional `OPENROUTER_API_KEY`. Free router and `:free` models only in this preset. |
| Ollama | `http://localhost:11434/v1` | Local installation/model required; normally no key. |
| Custom compatible API | Your explicit base URL | Your personal key, or endpoint-scoped `LLM_API_KEY` below. |

### Start without a personal API key

1. Open **Settings & providers**, or **New design**. A fresh installation defaults to the live Kilo free router; the offline example remains an explicit separate option.
2. Choose **Kilo Gateway (free, no key)**. Leave the API key empty.
3. Keep `kilo-auto/free`, or click **Load models** and select an available free model.
4. Click **Test connection**. This sends a synthetic JSON probe, not your system brief. A successful probe proves connectivity and JSON response handling, not full design quality or future availability.
5. Save configuration, create a **My own system** workspace, and run each stage explicitly.

Anonymous/public services may log prompts. Use synthetic/public information; do not send confidential business data, real personal information, passwords or other secrets. No fallback silently switches providers or sends a brief to a different endpoint. A free router may itself choose among models; traces record the returned model ID when available.

### Configure the workspace agent

Inside a live design workspace, the right sidebar shows **What this stage produces**, then **Agent configuration**. Select one provider and model for all stages, enter your temporary key, and use **Load models** and **Test connection**. Click **Save agent configuration**, or run a stage to save the selection automatically. Existing stage-specific overrides are cleared when saving or running from this UI, so they cannot silently select a different provider. Global Settings configure the default for new workspaces. Temporary keys are endpoint-scoped, never saved, and clear on refresh. Surrounding whitespace, copied quotes, and a pasted Bearer prefix are removed from keys.

Keys entered in the UI remain in memory, separately scoped to the exact API base URL. Changing providers cannot accidentally forward another provider's key. The application never stores keys in local/session storage, workspace JSON, artifacts or exports. For persistent server setup, copy `.env.example` to **gitignored** `.env.local` and enter your own keys:

```dotenv
LLM_PROVIDER=compatible
LLM_BASE_URL=https://ai-gateway.kilo.ai/api/v1
LLM_MODEL=kilo-auto/free
LLM_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
LLM_MAX_ATTEMPTS=3
LLM_TIMEOUT_MS=90000
```

Named server keys are only used for their catalog endpoint. `LLM_API_KEY` is only used when the chosen provider/base URL matches `LLM_PROVIDER`/`LLM_BASE_URL`. Restart after environment changes. The Settings screen reports configured-key presence, never the secret value. Ollama must run on the same machine as the app's server. Remote APIs require HTTPS; loopback HTTP is supported for local models and tests. Compatible APIs/models must support JSON-object chat completions.

A temporary key takes precedence over server keys; use **Use server key instead** to clear it. Quota, authentication and other non-transient HTTP errors stop immediately rather than retrying three times. Error details identify the actual endpoint, model and credential source without revealing the key. An `insufficient_user_quota` response is the provider reporting unavailable credit/quota for the submitted account/key; increasing a request/token limit or creating another key may not change account credit. Check the provider dashboard and key restrictions. To switch providers, change the workspace endpoint and supply its matching key, not just a different model.

Connection-test attempts are logged separately under gitignored `data/provider-checks/<uuid>.json` (or Redis diagnostics with 30-day retention); they do not clutter the workspace list. Normal stage attempts remain visible in Activity and the workspace export. Provider references: [Kilo Gateway](https://kilo.ai/docs/gateway/models-and-providers), [Groq compatibility](https://console.groq.com/docs/openai), [Gemini compatibility](https://ai.google.dev/gemini-api/docs/openai), [OpenRouter free models](https://openrouter.ai/collections/free-models/).

The offline Lumina example remains a **labelled deterministic fixture**, not real AI. Switching between fixture/live modes requires a new workspace. Change the database target through a design revision, not provider settings.

## The workflow

| Stage | Input | Visible output / gate |
| --- | --- | --- |
| 1. System intake | Natural-language brief | Structured actors, entities, processes, risks; `intake.md` |
| 2. Interview | Seven-category questions and user answers | At least one adaptive follow-up; model decides when sufficient; `requirements.md` |
| 3. DBMS choice | Consolidated requirements | PostgreSQL/MySQL/SQLite/SQL Server comparison, rationale and rejection reasons; `dbms-choice.md` |
| 4. Documentation | Requirements + DBMS | Four text-only explanations: `conceptual-model.md`, `logical-schema.md`, `normalization.md`, `assumptions.md`; the internal model remains in `design.json` |
| 5. Revision & approval | Natural-language changes | Regenerates all affected documents, records `changelog.md`, invalidates prior approval/SQL; explicit approval is mandatory |
| 6. SQL & validation | Explicitly approved model | `schema.sql`, `seed.sql`, `validation.md`; complete ZIP export |

All artifacts remain inspectable in the stage output panel and Artifacts tab. Continue buttons keep the client in control instead of skipping past results. Prompt library shows the actual server prompt files. Activity shows full inputs/outputs, timings, provider/model, success/failure, and attempt counts. Interview drafts survive page reloads. Sessions resume from their saved URL or dashboard.

Stage 4 shows each of its four outputs as readable text, describing the conceptual relationships, logical schema, normalization and assumptions without embedded diagrams, images or Markdown tables. Previews and exported documents use the same text. Existing saved workspaces are presented in this format from their canonical model without new AI calls. The separate Relationship map tab remains available outside these four text outputs.

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

Optional network checks using only a public synthetic equipment-lending scenario:

```powershell
npm run test:live -- --probe
npm run test:live
```

The full live check runs the real interview, selection, design, phone-number revision, approval and SQLite execution. It writes a resumable local workspace and, on success, `examples/equipment-club-live/`. It is not a deterministic CI test: shared free-model quotas, latency and service outages can cause a failure. Optional `LIVE_PROVIDER`, `LIVE_MODEL` and `LIVE_BASE_URL` select a different catalog provider/model; personal server keys are still required where applicable. Failure traces are saved after workflow actions without claiming completion.

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

The original development journal and acceptance audit remain outside the app and describe an earlier offline sprint, not current verification. See `docs/SPRINT_2.md` for the provider integration, fixes, test evidence and remaining limitations. Local data, output directories, keys, build files and browser reports are gitignored. The public repository includes only reviewed source and synthetic examples.


### Interview assistance

In Requirements interview, **Fill automatically** under the status badge drafts unanswered fields from the brief, intake, earlier rounds, and your existing answers. It preserves nonblank edits and marks unconfirmed standard choices as assumptions for review. Review or edit the drafts before submitting; autofill never submits or advances the interview. The offline example uses labelled fixture answers instead of a live model.

Submitting the first round produces an adaptive follow-up with an explanation. Once the reviewed answers are sufficient, submission automatically opens stage 3 (DBMS selection). Provider errors stay visible beside the questions, and draft answers remain available for retry.


### Design output capacity and notifications

Live stage 4 uses separate, resumable requests: first a compact table/dependency plan, then one complete table (schema, constraints, normalization and three sample rows) per request. Each successful part is persisted with the workspace before the next request starts. The UI shows saved table progress and can pause after the current part; **Resume design** continues after a pause, error or reload without regenerating finished tables. Temporary keys still need re-entry after refresh. Partial drafts do not unlock approval/SQL or count as a completed design. Final cross-table validation and all documents are compiled locally from the assembled canonical model. The API action `design` advances one part per call for live workspaces; callers repeat it using each returned session version until `session.design` exists. The offline example remains a single deterministic step.

Design subtask responses start with 2048 output tokens for planning and 4096 for a table, doubling only on truncation to a ceiling of min(8192, `LLM_DESIGN_MAX_TOKENS`). Each subtask gets at most two attempts, a default 60-second attempt timeout and a 150-second overall budget. `LLM_MAX_ATTEMPTS` can lower the attempt count and `LLM_TIMEOUT_MS` overrides the per-attempt timeout within the overall budget. Revision/repair calls retain their full-model contract, 8192-token initial budget, configurable ceiling (default 32768), 180-second default attempt timeout and 270-second overall budget. Model/provider limits still apply; incomplete or invalid data never counts as a finished design.

Notifications stay visible until their cross button is clicked. Only the newest three are retained; a fourth removes the oldest. Stage-4 failures also appear inline beside the generation button, with saved requirements preserved for retry.
