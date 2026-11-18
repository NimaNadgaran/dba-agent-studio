import { designDocumentNames, designTextOutputs } from "./design-documents";
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
  for (const document of designTextOutputs(session)) artifact(session, document.name, document.content, 4);
  artifact(session, "design.json", JSON.stringify(session.design, null, 2), 4);
  writeChangelog(session);
}

export function writeDesignTextParts(session: Session) {
  for (const part of session.designTextParts ?? []) artifact(session, part.name, part.content, 4);
  artifact(session, "stage-4-output.md", (session.designTextParts ?? []).map(part => part.content).join("\n\n"), 4);
}

export function writeChangelog(session: Session) {
  artifact(session, "changelog.md", `# Design changelog\n\n${session.changes.map(change => `## v${change.version} — ${change.at}\n\n**Request:** ${change.request}\n\n${change.summary}\n\n**Affected files:** ${change.files.join(", ")}`).join("\n\n") || "Initial design generated. No revisions requested yet."}\n\n## Approval\n\n${session.approvedAt ? `Design v${session.designVersion} explicitly approved at ${session.approvedAt}.` : "Not yet approved. SQL generation is locked until explicit approval."}\n`, 5);
}

export function writeValidation(session: Session, result: Validation) {
  artifact(session, "validation.md", `# SQL validation\n\n**Engine:** ${result.engine}\n\n**Status:** ${result.status}\n\n**Attempts:** ${result.attempts}\n\n**Duration:** ${result.durationMs} ms\n\n${table(["Check", "Result", "Detail"], result.checks.map(check => [check.name, check.passed ? "PASS" : "FAIL", check.detail]))}\n\n${result.error ? `## Error\n\n${result.error}\n\n` : ""}## Scope\n\n${result.status === "structural" ? "The target DBMS was not available. This is structural validation only, NOT successful target-engine execution. Run both files in the specified target engine before production." : "Schema and seed executed in an isolated, disposable embedded engine. No external or production database was modified. This verifies execution and populated tables, not every domain requirement, concurrency behavior, performance, or production permissions."}\n\n## Attempt history\n\n${session.validationHistory.map((item, index) => `- Attempt ${index + 1}: ${item.status} on ${item.engine}${item.error ? ` — ${item.error}` : ""}`).join("\n")}\n`, 6);
}

export const designFileNames = [...designDocumentNames, "design.json", "changelog.md"];
export function sortedArtifacts(artifacts: Record<string, Artifact>): Artifact[] {
  return Object.values(artifacts).sort((first, second) => first.stage - second.stage || first.name.localeCompare(second.name));
}
