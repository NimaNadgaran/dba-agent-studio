import { z } from "zod";
import { validateDesign } from "./design";
import { callModel, callTextModel } from "./provider";
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
  const summary = session.interview.summary.trim();
  const confirmedAnswers = session.interview.rounds.flatMap(round => round.questions.map(question => ({ question: question.question, answer: round.answers[question.id] })));
  const requirements = {
    brief: session.description,
    requirements: summary,
    ...(!summary ? { confirmedAnswers } : {}),
    dbms: session.choice?.selected,
  };
  if (!session.designDraft) {
    const plan = await callModel(session, "design", designPlanSchema, {
      ...requirements,
      phase: "plan",
      candidateEntities: session.intake?.entities,
      ...(summary && JSON.stringify(confirmedAnswers).length <= 4000 ? { confirmedAnswers } : {}),
    }, apiKeys, validatePlan, { prompt: "design-plan", label: "design plan" });
    session.designDraft = { plan, tables: [] };
    return;
  }
  const draft = session.designDraft;
  const target = draft.plan.tables[draft.tables.length];
  if (!target) throw new AppError("The saved design draft has no remaining table. Reload this workspace before continuing.", 409);
  const result = await callModel(session, "design", z.object({ table: designSchema.shape.tables.element }), {
    ...requirements,
    phase: "table",
    plan: { businessRules: draft.plan.businessRules, security: draft.plan.security, assumptions: draft.plan.assumptions },
    target,
    parents: draft.tables.filter(table => target.dependsOn.includes(table.name)).map(table => {
      const unique = [...table.unique, ...table.indexes.filter(index => index.unique).map(index => index.columns)];
      const keyColumns = new Set([...table.primaryKey, ...unique.flat()]);
      return {
        name: table.name,
        primaryKey: table.primaryKey,
        unique,
        columns: table.columns.filter(column => keyColumns.has(column.name)),
        rows: table.rows.map(row => Object.fromEntries(Object.entries(row).filter(([name]) => keyColumns.has(name)))),
      };
    }),
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

export async function generateDesignTextParts(session: Session, apiKeys?: string | ApiKeys) {
  const summary = session.interview.summary.trim();
  const text = await callTextModel(session, "design", {
    brief: session.description,
    entities: session.intake?.entities,
    requirements: summary,
    ...(!summary ? { confirmedAnswers: session.interview.rounds.flatMap(round => round.questions.map(question => ({ question: question.question, answer: round.answers[question.id] }))) } : {}),
    dbms: session.choice?.selected,
  }, apiKeys, "Stage 4 full design prompt");
  const headings = [
    ["# Conceptual model", "conceptual-model.md"],
    ["# Logical schema", "logical-schema.md"],
    ["# Normalization analysis", "normalization.md"],
    ["# Assumptions and remaining ambiguity", "assumptions.md"],
  ] as const;
  const positions = headings.map(([heading]) => text.indexOf(heading));
  if (positions.some(position => position < 0) || positions.some((position, index) => index > 0 && position <= positions[index - 1])) {
    throw new AppError("Stage 4 must return exactly four ordered sections beginning with the required # headings.");
  }
  return headings.map(([heading, name], index) => ({ name, title: heading.slice(2), content: text.slice(positions[index], positions[index + 1] ?? text.length).trim() }));
}
