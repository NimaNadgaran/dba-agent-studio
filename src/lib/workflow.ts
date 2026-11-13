import { randomUUID } from "node:crypto";
import { z } from "zod";
import { artifact, designFileNames, writeChangelog, writeChoice, writeDesign, writeIntake, writeRequirements, writeValidation } from "./artifacts";
import { demoAnswers, demoBrief, demoChoice, demoDesign, demoFollowups, demoIntake, demoQuestions } from "./demo";
import { generateSQL, validateDesign } from "./design";
import { callModel, environmentConfig, recordDemo } from "./provider";
import { AppError, categories, choiceSchema, designSchema, intakeSchema, interviewSchema, type Design, type ProviderConfig, type Session, type Stage } from "./types";
import { validateSQL } from "./validation";

export function newSession(description: string, config?: ProviderConfig): Session {
  const provider = config ?? environmentConfig();
  const now = new Date().toISOString();
  return { id: randomUUID(), title: provider.provider === "demo" ? "Lumina coworking" : "Untitled workspace", description: provider.provider === "demo" ? demoBrief : description, createdAt: now, updatedAt: now, version: 0, stage: 1, completedStages: [], mode: provider.provider === "demo" ? "demo" : "live", config: provider, interview: { rounds: [], pending: [], ready: false, summary: "", rationale: "Awaiting initial intake." }, designVersion: 0, artifacts: {}, changes: [], logs: [], validationHistory: [] };
}

function complete(session: Session, stage: Stage, next: Stage) {
  if (!session.completedStages.includes(stage)) session.completedStages.push(stage);
  session.stage = next;
}
function requireState(condition: unknown, message: string): asserts condition { if (!condition) throw new AppError(message, 409); }
function invalidate(session: Session) {
  session.approvedAt = undefined;
  session.validation = undefined;
  for (const name of ["schema.sql", "seed.sql", "validation.md"]) delete session.artifacts[name];
  session.completedStages = session.completedStages.filter(stage => stage < 5);
  session.stage = 5;
}
const context = (session: Session) => ({ brief: session.description, intake: session.intake, interview: session.interview, choice: session.choice });
const revisedSchema = z.object({ design: designSchema, selected: choiceSchema.shape.selected, summary: z.string().min(10), rationale: z.string().min(30), comparison: choiceSchema.shape.comparison });
function validateChoice(choice: z.infer<typeof choiceSchema>) {
  if (new Set(choice.comparison.map(item => item.dbms)).size !== 4) throw new AppError("DBMS comparison must contain all four distinct options.");
}

export type WorkflowAction = { action: "intake" | "interview" | "selection" | "design" | "revision" | "approve" | "sql" | "config"; answers?: Record<string, string>; request?: string; config?: ProviderConfig; apiKey?: string };

export async function transition(session: Session, action: WorkflowAction): Promise<Session> {
  const demo = session.mode === "demo";
  const apiKey = action.apiKey;
  if (action.action === "config") {
    if (!action.config) throw new AppError("Missing provider configuration.");
    if ((action.config.provider === "demo") !== demo) throw new AppError("Create a new workspace to switch between the example and live AI. This preserves provenance.");
    session.config = action.config;
  } else if (action.action === "intake") {
    requireState(!session.completedStages.includes(1), "Intake is already complete. Create a new workspace for a different brief.");
    if (session.description.trim().length < 30) throw new AppError("Describe your system in at least 30 characters.");
    const intake = demo ? structuredClone(demoIntake) : await callModel(session, "intake", intakeSchema, { description: session.description }, apiKey);
    const initial = demo ? { ready: false, questions: demoQuestions, rationale: "All seven requirement dimensions need confirmation.", summary: "" } : await callModel(session, "interview", interviewSchema, { phase: "initial", brief: session.description, intake, rounds: [] }, apiKey, result => {
      if (result.ready || categories.some(category => !result.questions.some(question => question.category === category)) || new Set(result.questions.map(question => question.id)).size !== result.questions.length) throw new AppError("Initial interview must cover all seven categories with distinct question IDs.");
    });
    if (demo) { recordDemo(session, "intake", session.description, intake); recordDemo(session, "interview", { phase: "initial" }, initial); }
    session.intake = intake;
    session.title = intake.title;
    session.interview.pending = initial.questions;
    session.interview.rationale = initial.rationale;
    writeIntake(session); writeRequirements(session);
    complete(session, 1, 2);
  } else if (action.action === "interview") {
    requireState(session.completedStages.includes(1) && !session.interview.ready && session.interview.pending.length, "Complete intake first, or continue to DBMS selection if the interview is done.");
    const answers = action.answers ?? {};
    for (const question of session.interview.pending) if (!answers[question.id] || answers[question.id].trim().length < 2) throw new AppError(`Please answer: ${question.question}`);
    const round = { questions: session.interview.pending, answers: Object.fromEntries(session.interview.pending.map(question => [question.id, answers[question.id].trim()])), at: new Date().toISOString() };
    const rounds = [...session.interview.rounds, round];
    const next = demo ? rounds.length === 1 ? { ready: false, questions: demoFollowups, rationale: "Your concurrency and retention answers need a targeted follow-up before the design can be trusted.", summary: Object.values(round.answers).join("\n\n") } : { ready: true, questions: [], rationale: "All seven dimensions are covered. Follow-up confirmed half-open booking intervals, per-space transaction locks, membership exclusivity, UTC, and privacy-preserving invoice retention.", summary: rounds.flatMap(item => Object.values(item.answers)).join("\n\n") } : await callModel(session, "interview", interviewSchema, { ...context(session), phase: "evaluate", rounds }, apiKey, result => {
      if (rounds.length < 2 && result.ready) throw new AppError("At least one adaptive follow-up round is mandatory. Return specific follow-up questions based on the first answers.");
      if (result.ready && (result.questions.length || result.summary.length < 80)) throw new AppError("A completed interview needs a consolidated summary and no pending questions.");
      if (!result.ready && !result.questions.length) throw new AppError("An incomplete interview needs follow-up questions.");
      if (new Set(result.questions.map(question => question.id)).size !== result.questions.length) throw new AppError("Follow-up question IDs must be unique.");
    });
    if (demo) recordDemo(session, "interview", { rounds }, next);
    session.interview = { rounds, pending: next.questions, ready: next.ready, summary: next.summary, rationale: next.rationale };
    writeRequirements(session);
    if (next.ready) complete(session, 2, 3);
  } else if (action.action === "selection") {
    requireState(session.interview.ready && !session.choice, "Finish the interview before choosing a DBMS; use revisions to change an existing choice.");
    const choice = demo ? structuredClone(demoChoice) : await callModel(session, "selection", choiceSchema, context(session), apiKey, validateChoice);
    if (demo) recordDemo(session, "selection", context(session), choice);
    session.choice = choice;
    writeChoice(session); complete(session, 3, 4);
  } else if (action.action === "design") {
    requireState(session.choice && !session.design, "Choose a DBMS first; use revisions to update an existing design.");
    const design = demo ? demoDesign() : await callModel(session, "design", designSchema, context(session), apiKey, validateDesign);
    validateDesign(design);
    if (demo) recordDemo(session, "design", context(session), design);
    session.design = design; session.designVersion = 1;
    writeDesign(session); complete(session, 4, 5);
  } else if (action.action === "revision") {
    requireState(session.design && session.choice, "Generate a design before requesting revisions.");
    if (!action.request || action.request.trim().length < 8) throw new AppError("Describe your revision in at least 8 characters.");
    let revision: z.infer<typeof revisedSchema>;
    if (demo) {
      const design = structuredClone(session.design);
      const request = action.request.toLowerCase();
      const target = request.includes("sqlite") ? "SQLite" : request.includes("mysql") || request.includes("mariadb") ? "MySQL" : request.includes("sql server") ? "SQL Server" : request.includes("postgres") ? "PostgreSQL" : undefined;
      if (target) revision = { design, selected: target, summary: `Switched target to ${target}; all logical types, documentation and subsequent SQL regenerate from the canonical model.`, rationale: `The explicit demonstration revision requests ${target}. This overrides the original production recommendation for comparison/testing. Review its concurrency and deployment trade-offs against the confirmed requirements.`, comparison: session.choice.comparison.map(item => ({ ...item, verdict: item.dbms === target ? "Selected by explicit user revision" : "Not selected after user override" })) };
      else if (request.includes("phone")) {
        const members = design.tables.find(table => table.name === "members")!;
        if (members.columns.some(column => column.name === "phone")) throw new AppError("The phone column is already present. Try a DBMS switch, or use live AI for another revision.");
        members.columns.push({ name: "phone", type: "string", nullable: true, description: "Optional member phone number in international format", length: 30 });
        members.rows.forEach((row, index) => { row.phone = index === 1 ? null : `+1-202-555-01${String(index + 10)}`; });
        members.functionalDependencies = members.functionalDependencies.map(dependency => `${dependency}, phone`);
        design.security.push("Member phone numbers are optional private contact details; restrict access and include them in anonymization.");
        revision = { design, selected: session.choice.selected, summary: "Added optional private member phone numbers, realistic/null sample values, updated functional dependencies and privacy handling. All design artifacts regenerate.", rationale: session.choice.rationale, comparison: session.choice.comparison };
      } else throw new AppError("Offline example revisions support ‘Add an optional phone number to members’ or ‘Switch to SQLite / PostgreSQL / MySQL / SQL Server’. Arbitrary natural-language changes require a live model.");
      recordDemo(session, "revision", { request: action.request }, revision);
    } else revision = await callModel(session, "revision", revisedSchema, { ...context(session), design: session.design, request: action.request }, apiKey, result => { validateDesign(result.design); validateChoice({ selected: result.selected, rationale: result.rationale, comparison: result.comparison }); });
    validateDesign(revision.design);
    session.design = revision.design;
    session.choice = { selected: revision.selected, rationale: revision.rationale, comparison: revision.comparison };
    session.designVersion += 1;
    session.changes.push({ version: session.designVersion, at: new Date().toISOString(), request: action.request, summary: revision.summary, files: ["dbms-choice.md", ...designFileNames, "schema.sql (invalidated)", "seed.sql (invalidated)", "validation.md (invalidated)"] });
    invalidate(session); writeChoice(session); writeDesign(session);
  } else if (action.action === "approve") {
    requireState(session.design && session.choice && !session.approvedAt, "Generate and review the design before approving it.");
    session.approvedAt = new Date().toISOString();
    writeChangelog(session); complete(session, 5, 6);
  } else if (action.action === "sql") {
    requireState(session.design && session.choice && session.approvedAt, "Explicitly approve the current design before SQL generation.");
    const maxAttempts = 3;
    let repaired = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const sql = generateSQL(session.design!, session.choice.selected);
      const result = await validateSQL(session.design!, session.choice.selected);
      result.attempts = attempt;
      session.validation = result; session.validationHistory.push(result);
      if (result.status !== "failed") {
        if (repaired) {
          invalidate(session);
          session.validation = result;
          writeDesign(session); writeValidation(session, result);
          break;
        }
        artifact(session, "schema.sql", sql.schema, 6); artifact(session, "seed.sql", sql.seed, 6);
        writeValidation(session, result); complete(session, 6, 6);
        break;
      }
      writeValidation(session, result);
      if (demo || attempt === maxAttempts) break;
      const fixed: Design = await callModel(session, "repair", designSchema, { ...context(session), design: session.design, schema: sql.schema, seed: sql.seed, error: result.error, validationAttempt: attempt }, apiKey, validateDesign);
      session.design = fixed; session.designVersion += 1; repaired = true;
      session.changes.push({ version: session.designVersion, at: new Date().toISOString(), request: "Automatic execution-validation repair", summary: `Corrected canonical model after ${result.engine} rejected execution: ${result.error}. Approval invalidated; review is required before exporting SQL.`, files: [...designFileNames, "schema.sql (invalidated)", "seed.sql (invalidated)"] });
      invalidate(session); writeDesign(session);
    }
    if (repaired && !session.completedStages.includes(6)) { session.approvedAt = undefined; session.stage = 5; writeChangelog(session); }
  }
  return session;
}

export { demoAnswers };
