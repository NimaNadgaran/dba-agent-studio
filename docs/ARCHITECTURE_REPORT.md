# DBA Agent — short architecture report

## 1. Workflow and state

The application is a Next.js/TypeScript website with a client studio and Node route handlers. A workspace contains its original brief, provider configuration, stage/completion state, question/answer rounds, DBMS decision, canonical design, approval timestamp, versioned artifacts, change history, validation history, and provider-call traces. The six stages execute in the PDF's order. Guards reject skipped stages. The client deliberately stays on a stage after generating its output so a person can inspect it before continuing.

Intake structures actors, entities and processes. The interview starts with all seven required categories. The next model evaluation must ask a real follow-up based on the first answers; completion is rejected until at least two rounds have been answered. Later evaluations let the model decide whether requirements are sufficient. Selection compares all four required relational engines and validates that each appears exactly once. Design generation creates the complete typed canonical object. Revisions accept natural language, update the whole model, regenerate affected files, and require renewed explicit approval. SQL is gated on that approval.

State defaults to atomic JSON replacement in `data/`; outputs mirror current artifacts in `outputs/<uuid>/`. Per-workspace serialization and optimistic versions prevent accidental lost updates. A model-stage failure rolls back domain-state changes but preserves its call logs. File output is a recoverable mirror, not an independent source of truth. The optional REST Redis adapter stores the same object and uses a distributed lease for serverless requests.

## 2. Prompt/provider boundary

Readable Markdown prompts live in `prompts/`, outside source. A shared system instruction treats the user's text as domain data, not workflow authority. Each prompt defines its stage's JSON input/output contract; the design contract specifies keys, types, constraints, dependencies and sample rows. The provider adapter sends OpenAI-compatible JSON-object chat-completion requests to the configured provider/model/base URL, including Ollama. Configuration changes require no code edits.

Every attempt records its full messages, output, error, provider/model, stage, duration and attempt number. Runtime schemas and structural checks reject malformed outputs; a bounded retry includes the precise error. Secrets are carried separately from session state and redacted from traces. The browser's optional temporary API key remains in memory only. The offline coworking mode is explicitly a deterministic fixture and uses a distinct provenance label; it never pretends to handle unseen systems with AI.

## 3. Canonical compilation and consistency

Generating prose, diagrams and SQL independently risks drift. Instead, a single validated relational model drives `conceptual-model.md`, `logical-schema.md`, `normalization.md`, `assumptions.md`, Mermaid ER diagrams, `design.json`, `schema.sql`, and `seed.sql`. Requirements and DBMS-selection documents derive from interview/decision state. Changelogs identify requests, reasons, versions and affected files.

The model supports composite primary/unique/foreign keys, nullability, literal defaults, portable CHECK predicates, indexes, sample rows and documented functional dependencies. The compiler maps abstract types to four SQL dialects, escapes literals, orders tables by FK dependencies, and adds uncovered FK indexes. Structural validation checks identifiers, key existence/uniqueness, parent references, matching FK types, SET NULL feasibility, seed types, defaults, uniqueness and graph order. It rejects unsafe CHECK functions rather than executing arbitrary model-supplied SQL. Exported SQL creates objects inside a new, already-existing empty database; it does not require privileged database creation.

## 4. Validation and repair

PostgreSQL validation uses isolated PGlite; SQLite uses isolated sql.js with FK enforcement, integrity checks and exact per-table row counts. Nothing connects to production. MySQL/SQL Server report structural validation only, not execution success. The optional bonus loop feeds actual execution errors to the model, repairs the canonical source, recompiles and retries at most three validation attempts. Provider attempts are independently bounded and logged. Any design repair invalidates approval: even a passing repair cannot silently replace a human-approved design.

Automated tests cover dialect compilation, actual PostgreSQL/SQLite execution, bad keys/checks, literal escaping, interviews, stage ordering, revision propagation, invalidation, resume/persistence, adapter retries and secret redaction. Browser/API acceptance tests exercise the complete client flow, diagrams, artifact previews, downloads, mobile layout, HTTP boundaries and optimistic conflicts. Mock-provider integration tests verify adapter behavior, not the quality of a remote model.

## 5. Decisions and limitations

Next.js provides a localhost website now and a Node server-function route later. No service was deployed. Local fonts and native CSS/SVG avoid a runtime external asset dependency. Prompts, traces and stage artifacts remain visible because workflow explainability is a primary project requirement.

The separately referenced test `scenario.md`, real provider credentials, Redis credentials, MySQL and SQL Server instances were not supplied. Those integrations/scenario results cannot honestly be claimed as verified. The illustrative example is included instead. Normalization and requirement completeness remain semantic judgments: neither a passing SQL run nor a surrogate key proves 3NF. Cross-row overlaps and access rules are explicitly documented application/transaction policies, not falsely advertised CHECK guarantees. The bounded compiler does not synthesize arbitrary procedural SQL, cyclic migrations, or production security provisioning. The app is a private single-user studio; hosted multi-tenancy and large/background workloads require additional architecture. See the critique and compliance reports for the detailed audit.
