import { automaticIndexes, columnDomainChecks, mermaidDiagram, relationshipIsUnique, sqlType } from "./design";
import type { Artifact, Session, Stage, Validation } from "./types";

export function artifact(session: Session, name: string, content: string, stage: Stage) {
  session.artifacts[name] = { name, content, stage, updatedAt: new Date().toISOString(), version: session.designVersion };
}

const bullet = (items: string[]) => items.length ? items.map(item => `- ${item}`).join("\n") : "- None identified.";
const cell = (value: unknown) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const table = (headers: string[], rows: unknown[][]) => `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${rows.map(row => `| ${row.map(cell).join(" | ")} |`).join("\n")}`;

export function writeIntake(session: Session) {
  const intake = session.intake!;
  artifact(session, "intake.md", `# ${intake.title}\n\n## Original brief\n\n${session.description}\n\n## Initial understanding\n\n${intake.summary}\n\n## Actors\n\n${bullet(intake.actors)}\n\n## Candidate entities\n\n${bullet(intake.entities)}\n\n## Main processes\n\n${bullet(intake.processes)}\n\n## Questions and risks\n\n${bullet(intake.risks)}\n`, 1);
}

export function writeRequirements(session: Session) {
  const rounds = session.interview.rounds.map((round, index) => `## Interview round ${index + 1}\n\n${round.questions.map(question => `### ${question.category}\n\n**Question:** ${question.question}\n\n**Answer:** ${round.answers[question.id] ?? "Not yet answered"}`).join("\n\n")}\n\n${round.rationale ?? ""}`).join("\n\n");
  artifact(session, "requirements.md", `# Requirements — ${session.title}\n\n**Status:** ${session.interview.ready ? "Interview complete" : "Interview in progress"}\n\n## System brief\n\n${session.description}\n\n## Consolidated requirements\n\n${session.interview.summary || session.intake?.summary || "Awaiting interview."}\n\n${rounds}\n\n## Interview decision\n\n${session.interview.rationale}\n\n## Outstanding questions\n\n${bullet(session.interview.pending.map(question => question.question))}\n`, 2);
  if (session.changes.length) session.artifacts["requirements.md"].content += `\n## Current requirements after revisions\n\nThe original brief and interview above are preserved as history. The following later user requests supersede conflicting earlier requirements. Read these together with the current design.json.\n\n${session.changes.map(change => `### v${change.version}: ${change.request}\n\n${change.summary}`).join("\n\n")}\n\n### Current business rules\n\n${bullet(session.design?.businessRules ?? [])}\n`;
}

export function writeChoice(session: Session) {
  const choice = session.choice!;
  artifact(session, "dbms-choice.md", `# DBMS selection\n\n## Selected: ${choice.selected}\n\n${choice.rationale}\n\n## Requirements-based comparison\n\nScores are relative suitability judgments for this workload, not measured performance benchmarks.\n\n${table(["DBMS", "Fit / 10", "Strengths", "Trade-offs", "Decision"], choice.comparison.map(item => [item.dbms, item.score, item.strengths, item.tradeoffs, item.verdict]))}\n\n## Source of decision\n\nBased on the original brief and all ${session.interview.rounds.length} completed interview rounds in requirements.md.\n`, 3);
}

export function writeDesign(session: Session) {
  const design = session.design!;
  const dbms = session.choice!.selected;
  const version = `**Design version:** ${session.designVersion} · **Target:** ${dbms}`;
  artifact(session, "conceptual-model.md", `# Conceptual model — ${design.name}\n\n${version}\n\n${design.overview}\n\n## Entities\n\n${design.tables.map(item => `### ${item.name}\n\n${item.purpose}`).join("\n\n")}\n\n## Entity-relationship diagram\n\n\`\`\`mermaid\n${mermaidDiagram(design)}\n\`\`\`\n\n## Relationships and cardinality\n\n${design.tables.flatMap(item => item.foreignKeys.map(key => {
    const optional = key.columns.some(name => item.columns.find(column => column.name === name)?.nullable);
    const one = relationshipIsUnique(item, key.columns);
    return `- ${item.name} (${key.columns.join(", ")}) → ${key.refTable} (${key.refColumns.join(", ")}): ${one ? "one-to-one" : "many-to-one"}; ${optional ? "optional parent" : "required parent"}; parent deletion: ${key.onDelete}. A parent can have zero ${one ? "or one" : "or many"} matching child records.`;
  })).join("\n") || "No cross-entity relationships."}\n\n## Business rules\n\n${bullet(design.businessRules)}\n`, 4);
  artifact(session, "logical-schema.md", `# Logical schema\n\n${version}\n\nIdentifiers use portable lowercase snake_case. IDs are application-supplied; no auto-increment allocation is assumed.\n\n${design.tables.map(item => `## ${item.name}\n\n${item.purpose}\n\n${table(["Column", "Type", "Nullable", "Default", "Description"], item.columns.map(column => [column.name, sqlType(column, dbms), column.nullable ? "Yes" : "No", column.default === undefined ? "—" : JSON.stringify(column.default), column.description]))}\n\n- **Primary key:** ${item.primaryKey.join(", ")}\n- **Unique keys:** ${item.unique.map(names => `(${names.join(", ")})`).join("; ") || "None beyond primary key"}\n- **Foreign keys:** ${item.foreignKeys.map(key => `(${key.columns.join(", ")}) → ${key.refTable}(${key.refColumns.join(", ")}); ON DELETE ${dbms === "SQL Server" && key.onDelete === "RESTRICT" ? "NO ACTION" : key.onDelete}`).join("; ") || "None"}\n- **Checks:** ${item.checks.map(check => `${check.name}: ${check.expression}`).join("; ") || "None"}\n- **Compiler-added column domains:** ${columnDomainChecks(item, dbms).join("; ") || "None beyond declared types"}\n- **Declared indexes:** ${item.indexes.map(index => `${index.name} (${index.columns.join(", ")})${index.unique ? " UNIQUE" : ""}`).join("; ") || "None"}\n- **Automatic indexing:** primary/unique keys are indexed by the engine. The SQL compiler adds an index on each foreign-key column group not already covered by a leading primary/unique/declared index.\n- **Sample rows:** ${item.rows.length}`).join("\n\n")}\n\n## Relational schema diagram\n\n\`\`\`mermaid\n${mermaidDiagram(design, dbms)}\n\`\`\`\n\n## Security and privacy\n\n${bullet(design.security)}\n\nSecurity policies below are architectural requirements. Application authentication, encryption at rest, and production DB role provisioning must be implemented at deployment; the SQL export does not invent credentials or create privileged users.\n`, 4);
  artifact(session, "normalization.md", `# Normalization analysis\n\n${version}\n\n## Method\n\n1NF requires atomic attributes and unique rows. 2NF excludes partial dependencies on part of a composite candidate key. 3NF excludes non-key transitive dependencies. Surrogate primary keys alone do not prove 3NF. The following dependency claims must be reviewed against the actual business semantics.\n\n${design.tables.map(item => `## ${item.name}\n\n### Functional dependencies\n\n${bullet(item.functionalDependencies)}\n\n### Normal-form assessment\n\n${item.normalization}`).join("\n\n")}\n\n## Deliberate denormalization\n\n${design.denormalizations.length ? bullet(design.denormalizations) : "No deliberate denormalization. Every table is intended to satisfy at least 3NF."}\n\n## Validation boundary\n\nExecution checks prove syntax and constraint/seed compatibility, not the truth of functional dependencies. A human must confirm semantic normalization.\n`, 4);
  artifact(session, "assumptions.md", `# Assumptions and remaining ambiguity\n\n${version}\n\n${bullet(design.assumptions)}\n\n## Operational assumptions\n\n- Run schema.sql in an existing empty database with appropriate CREATE privileges. Do not run it against production.\n- Seed data is synthetic and contains no real personal information.\n- Sample data is not an exhaustive performance or security test.\n- Monetary decimal values are illustrative; production applications should use exact decimal serialization.\n- All generated files derive from one canonical design model, included as design.json in the export.\n- ${session.mode === "demo" ? "This is the explicitly labelled offline coworking example, not an LLM interpretation of an arbitrary brief." : "The design is model-generated and needs human domain review before production use."}\n`, 4);
  artifact(session, "design.json", JSON.stringify(design, null, 2), 4);
  const addedIndexes = design.tables.flatMap(item => automaticIndexes(item).map(index => [item.name, index.name, index.columns.join(", ")]));
  session.artifacts["logical-schema.md"].content += `\n## Compiler-added foreign-key indexes\n\n${addedIndexes.length ? table(["Table", "Index", "Columns"], addedIndexes) : "None required."}\n`;
  writeChangelog(session);
}

export function writeChangelog(session: Session) {
  artifact(session, "changelog.md", `# Design changelog\n\n${session.changes.map(change => `## v${change.version} — ${change.at}\n\n**Request:** ${change.request}\n\n${change.summary}\n\n**Affected files:** ${change.files.join(", ")}`).join("\n\n") || "Initial design generated. No revisions requested yet."}\n\n## Approval\n\n${session.approvedAt ? `Design v${session.designVersion} explicitly approved at ${session.approvedAt}.` : "Not yet approved. SQL generation is locked until explicit approval."}\n`, 5);
}

export function writeValidation(session: Session, result: Validation) {
  artifact(session, "validation.md", `# SQL validation\n\n**Engine:** ${result.engine}\n\n**Status:** ${result.status}\n\n**Attempts:** ${result.attempts}\n\n**Duration:** ${result.durationMs} ms\n\n${table(["Check", "Result", "Detail"], result.checks.map(check => [check.name, check.passed ? "PASS" : "FAIL", check.detail]))}\n\n${result.error ? `## Error\n\n${result.error}\n\n` : ""}## Scope\n\n${result.status === "structural" ? "The target DBMS was not available. This is structural validation only, NOT successful target-engine execution. Run both files in the specified target engine before production." : "Schema and seed executed in an isolated, disposable embedded engine. No external or production database was modified. This verifies execution and populated tables, not every domain requirement, concurrency behavior, performance, or production permissions."}\n\n## Attempt history\n\n${session.validationHistory.map((item, index) => `- Attempt ${index + 1}: ${item.status} on ${item.engine}${item.error ? ` — ${item.error}` : ""}`).join("\n")}\n`, 6);
}

export const designFileNames = ["conceptual-model.md", "logical-schema.md", "normalization.md", "assumptions.md", "design.json", "changelog.md"];
export function sortedArtifacts(artifacts: Record<string, Artifact>): Artifact[] {
  return Object.values(artifacts).sort((first, second) => first.stage - second.stage || first.name.localeCompare(second.name));
}
