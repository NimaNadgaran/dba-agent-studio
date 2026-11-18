import { z } from "zod";
import { validateDesign } from "./design";
import { callModel } from "./provider";
import { AppError, designPlanSchema, designSchema, type ApiKeys, type Design, type DesignPlan, type Session } from "./types";

function validatePlan(plan: DesignPlan) {
  const preceding = new Set<string>();
  for (const table of plan.tables) {
    if (preceding.has(table.name)) throw new AppError("Each planned table must have a distinct name.");
    if (new Set(table.dependsOn).size !== table.dependsOn.length || table.dependsOn.some(parent => !preceding.has(parent))) throw new AppError("List tables in parent-first order. Dependencies must name distinct earlier tables, never the table itself. Avoid circular relationships.");
    preceding.add(table.name);
  }
}

export async function advanceDesign(session: Session, apiKeys?: string | ApiKeys): Promise<Design | undefined> {
  const requirements = {
    brief: session.description,
    intake: session.intake,
    requirements: session.interview.summary,
    confirmedAnswers: session.interview.rounds.flatMap(round => round.questions.map(question => ({ question: question.question, answer: round.answers[question.id] }))),
    choice: session.choice,
  };
  if (!session.designDraft) {
    const plan = await callModel(session, "design", designPlanSchema, { ...requirements, phase: "plan" }, apiKeys, validatePlan, { prompt: "design-plan", label: "design plan" });
    session.designDraft = { plan, tables: [] };
    return;
  }
  const draft = session.designDraft;
  const target = draft.plan.tables[draft.tables.length];
  if (!target) throw new AppError("The saved design draft has no remaining table. Reload this workspace before continuing.", 409);
  const result = await callModel(session, "design", z.object({ table: designSchema.shape.tables.element }), {
    ...requirements,
    phase: "table",
    plan: draft.plan,
    target,
    parents: draft.tables.filter(table => target.dependsOn.includes(table.name)),
    reservedNames: draft.tables.flatMap(table => [...table.indexes, ...table.checks].map(item => item.name)),
  }, apiKeys, candidate => {
    if (candidate.table.name !== target.name) throw new AppError("Return only the requested table: " + target.name + ".");
    if (candidate.table.foreignKeys.some(key => key.refTable !== target.name && !target.dependsOn.includes(key.refTable))) throw new AppError("Foreign keys may only reference this table or its declared dependencies. Use the supplied parent keys and rows exactly.");
    validateDesign(designSchema.parse({ ...draft.plan, tables: [...draft.tables, candidate.table] }));
  }, { prompt: "design-table", label: "design table " + target.name });
  const tables = [...draft.tables, result.table];
  if (tables.length < draft.plan.tables.length) {
    session.designDraft = { plan: draft.plan, tables };
    return;
  }
  const design = designSchema.parse({ ...draft.plan, tables });
  validateDesign(design);
  return design;
}

