# Prompt / PDF compliance matrix

Reference: the eight-page `dba_agent_project.pdf` supplied locally outside this repository. The separate test-scenario file mentioned by that PDF was absent. This original matrix describes the first offline sprint; see `SPRINT_2.md` for current public-repository status, real-provider testing, selectable agents, and later fixes. This is not a guarantee of a grade or semantic perfection from every possible model.

| Requirement | Implementation / evidence | Result |
| --- | --- | --- |
| Website on localhost; no hosting deployment | Next.js binds 127.0.0.1:3000; user subsequently requested a public GitHub repository, now published | Implemented; hosting not deployed |
| Full project in requested code directory | Existing `project_code/` used; `project_cde` treated as a spelling inconsistency | Implemented |
| Log steps/knowledge outside code directory | `../PROJECT_LOG.md`, with milestones, findings, tests, limits | Implemented |
| Client sees every stage output | Six-stage workspace, output panels, preview/source, manual continue, artifact and map tabs | Implemented / browser-tested |
| Refined high-end frontend | Custom responsive studio, local variable fonts, forest/lime visual system, schema art, motion/accessibility controls | Implemented / desktop/mobile reviewed |
| Intake: actors/entities/processes | `intake` prompt, typed model, structured UI, intake.md | Implemented |
| Seven interview categories | Enforced distinct category coverage before first round | Implemented / tested |
| At least one answer-based follow-up | Runtime forbids readiness after first round; prompt supplies full prior answers | Implemented / fixture + mock-adapter tested |
| Agent decides when enough | Later interview evaluations return readiness, summary and rationale | Implemented; external model quality not yet tested |
| requirements.md | Generated and updated with brief, all answered rounds and interview decision | Implemented / exported |
| Four target DBMSs | PostgreSQL, MySQL/MariaDB, SQLite, SQL Server | Implemented / all compiled |
| Choice rationale/comparison/rejections | All four distinct options validated; selection and revision update dbms-choice.md | Implemented / tested |
| Four required design documents | conceptual-model.md, logical-schema.md, normalization.md, assumptions.md | Implemented / exported |
| Mermaid ER and relational diagrams | Derived from canonical tables and FKs; rendered client-side with strict security | Implemented / browser-tested |
| Keys, types, constraints, indexes, dependencies | Typed design contract and dialect-aware compiler; actual automatic index inventory | Implemented / structurally checked |
| At least 3NF / explain denormalization | FD analysis, normal-form prose, explicit denormalization list and assumptions | Implemented; semantic human review remains necessary |
| Natural-language revision loop | Live revision prompt returns complete updated canonical design; repeated requests supported | Implemented; mock/fixture paths tested, real model needs credentials |
| Propagate changes to every affected file | Regenerate all design files and DBMS report; remove stale SQL/validation | Implemented / regression + API tested |
| changelog.md | Request/reason/version/affected files/approval | Implemented / exported |
| Explicit approval before SQL | Guarded approval action; revision/repair invalidates it | Implemented / tested |
| Complete schema.sql and mandatory seed.sql | Four dialect compilers; safe values/order/keys; every table seeded | Implemented |
| Realistic seed / interesting cases | Meaningful names, junction rows, optional FK null/populated, multiple states, zero amount and date boundaries | Implemented / real engine checked |
| Final SQL executes correctly | Actual PostgreSQL and SQLite execution | Verified for generated example and tests |
| MySQL/MariaDB and SQL Server execution | Correct-dialect compilation + structural checks; no engines supplied | Not engine-verified; explicitly disclosed |
| Persistence/resume | Atomic local JSON, output mirror, request serialization, optimistic conflict protection | Implemented / reload + filesystem tested |
| Configurable provider/model without edits | UI and environment configuration for compatible/Ollama providers | Implemented / local adapter integration-tested |
| Prompt files outside source | Eight readable Markdown files in prompts/ | Implemented |
| Every LLM call logged | Stage/input/output/provider/model/attempt/error/duration; secret redaction | Implemented / retry/redaction tested |
| Organized output folder | outputs/<uuid>/ plus complete ZIP; current session and call traces included | Implemented / disk + ZIP tested |
| Git repository and README | Public GitHub repository, setup/configuration/usage/example/test instructions | Published at user's later request |
| Complete example for supplied scenario | Complete illustrative examples/lumina/ run instead | Blocked for exact scenario: scenario.md not supplied |
| Short architecture report | docs/ARCHITECTURE_REPORT.md | Delivered |
| Critique report / ≥3 actual findings | docs/CRITIQUE_REPORT.md, six reviewed concerns including concrete code/design fixes | Delivered |
| Bonus real validation/repair loop | Isolated PGlite/sql.js execution; exact errors returned for repair; three validation attempts max; all provider attempts logged | Implemented / simulated-model repair + real execution tested |
| Test everything and repair failures | TypeScript, unit/integration, optimized build, UI/API acceptance, mobile screenshots; running evidence in journal | Implemented; external-service boundaries clearly excluded |
| Future Vercel without deploy now | Node route handlers, tracing assets, REST Redis adapter, mandatory hosted token, deployment checklist | Prepared, not deployed; remote Redis/hosting unverified |

## Honest overall verdict

The requested local website and all six workflow stages are implemented. Local automated checks can verify the actual workflow/compiler, example, persistence, UI and supported embedded engines. It would be inaccurate to claim the missing supplied scenario, remote LLM semantic quality, live MySQL/SQL Server execution, or Vercel/Redis deployment has been verified. Those are explicit external-input/engine boundaries, not hidden successful-test claims.
