# Sprint 2: real providers, selectable agents and verification

Date: November 13, 2026. This report supersedes the earlier offline-sprint acceptance claims where they differ. The course's separate `scenario.md` is still absent.

## Repository

The user requested public publication before further development. Created `NimaNadgaran/dba-agent-studio` and pushed the original source as commit `49a07e2`, with the exact message `first sprint with no real api agent`. Secrets, local sessions, build files and browser reports are excluded. No web hosting deployment is performed.

## Provider integration and workflow choices

Reviewed the teacher's `mnfst/awesome-free-llm-apis` list and provider documentation. Added Kilo Gateway, Groq, Gemini and OpenRouter presets, plus local Ollama and custom-compatible configuration. Kilo's anonymous free endpoint was exercised with real requests. A provider list is not a source of personal API keys: users must obtain their own Groq/Gemini/OpenRouter keys. Those presets and environment placeholders are ready, but account-dependent calls were not falsely marked verified. An unreachable anonymous OVH endpoint was checked and omitted rather than advertised as working.

Settings and the new-workspace dialog expose endpoint, model, scoped temporary key, model discovery and a synthetic JSON connection test. Free-router presets refuse paid model IDs. Six workflow roles can independently inherit the workspace default or select a provider/model: intake, interview, selection, design, revision and validation repair. Stage 1 also invokes the interview role. SQL generation itself is deterministic; approval never invokes a model. Choices persist in workspace state, and traces include selected endpoint/model plus the resolved model returned by a router. Configuration changes do not invalidate an otherwise unchanged approved domain design.

Browser keys live only in React memory, keyed to the exact API base URL. Named server keys are restricted to their catalog endpoint; the generic server key is restricted to its configured provider/base URL. The UI only reports key presence. No personal credentials are stored in tracked files or generated sessions/exports. Model-list requests are not LLM calls. Connection-test LLM attempts are recorded under gitignored `data/provider-checks/<uuid>.json`, separate from workspaces; the optional Redis adapter retains diagnostic records for 30 days. Stage calls remain in session/export traces. Free public APIs may log prompts; the UI and README warn against confidential data.

## Findings and root-cause fixes

1. **Stale requirements after revision:** `requirements.md` preserved only the original interview. It now explicitly records later superseding requests and current business rules, retaining the original answers as history. Automatic repair also refreshes this derived view.
2. **Incorrect one-to-one diagrams:** cardinality ignored unique indexes. Diagrams and prose now use the same candidate-key logic, including unique indexes and a unique subset of a composite FK.
3. **Cross-provider credential leakage risk:** the original generic environment key could follow a changed base URL. Credential lookup is now endpoint-scoped and covered by regression tests.
4. **Model prose could escape SQL comments:** multiline design names/table descriptions were interpolated directly after `--`. Each physical line is now independently commented; a real SQLite regression confirms injected DROP text remains inert.
5. **SQLite ignored VARCHAR length:** seed validation rejected long values, but future database writes were not protected. The compiler now emits actual SQLite length CHECKs and documents compiler-added domains. Tests insert an overlong future value into the real engine and confirm rejection while allowing nulls.
6. **MySQL expression defaults:** hex-converted string defaults now use parenthesized expressions. This is covered structurally, not misrepresented as live MySQL execution.
7. **Actual live output needed semantic review:** the first live example used timestamps for explicitly requested date-only fields and contained contradictory email-uniqueness wording. A second real-model revision corrected both; seeds, documents and SQL were regenerated and executed again. Prompts now explicitly distinguish format validation from uniqueness and preserve requested date granularity. Passing SQL alone would not have caught these two issues.

## Real-model evidence

`examples/equipment-club-live/` contains a complete real run on a new public synthetic equipment-lending scenario, unrelated to the offline coworking fixture. It is not the missing course scenario and is not a hard-coded live-provider response.

- Workspace: `d1362266-b41e-412b-8130-58f365e4a113`, final design version 3.
- Anonymous Kilo `kilo-auto/free` router; no personal API key used.
- Nine logged real model calls across connectivity, intake, initial/adaptive interviews, selection, design and two revisions. Returned model IDs include `dots-studio/dots-3-note-preview:free` and `baidu/ernie-5.5-flash-preview:free`.
- Seven initial categories and one follow-up round; the model decided readiness after the second answered round.
- Three related tables; candidate keys, required FKs, retention/deletion rules, valid dates, populated/null optional phone values, open/returned loans and realistic synthetic seed rows.
- Explicit synthetic review/approval, actual SQLite schema/seed execution, FK/integrity checks and exact row counts pass. The optional phone limit is enforced on future writes, not only in seeds.
- A free router can change its underlying model; model IDs above are recorded evidence, not availability guarantees. Shared quotas/latency can make future network runs fail.

## Validation and limits

The updated suite contains 28 passing unit/integration tests and 6 passing production-browser/API acceptance tests. TypeScript and the optimized production build pass. The deterministic example also executes in PostgreSQL/PGlite. Browser checks cover provider presets, model loading, JSON probing, distinct stage-model routing, saved selections after reload, key clearing/non-persistence, API guards, the complete fixture flow, exports and mobile overflow. A desktop screenshot of the new picker was inspected. Fresh installs default to the anonymous live Kilo router; the offline fixture must be explicitly selected.

Commands: `npm run typecheck`, `npm test`, `npm run build`, `npm run example`, `npm run test:e2e`, `npm run test:live`, and the real follow-up review `npm run test:live -- --review-example`.

Windows occasionally blocks the TypeScript runner's user-information lookup or writes to pre-existing compiler caches inside the sandbox; the same commands succeed with approved execution outside it. This is recorded as an environment restriction, not hidden application success.

Remaining limits: no supplied `scenario.md`; no personal account verification for Groq/Gemini/OpenRouter; no live MySQL/MariaDB or SQL Server engine; no remote Redis/hosting verification. Normalization, requirement completeness, real application concurrency, privacy practices and production readiness still need human/domain review. Automatic repair is bounded and reapproval is mandatory. No test claims every model or arbitrary unseen domain will work perfectly.
