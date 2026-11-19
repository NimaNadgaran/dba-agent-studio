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

const concurrency = () => Math.max(1, Math.min(6, Math.floor(Number(process.env.LLM_DESIGN_CONCURRENCY) || 4)));

export async function advanceDesign(session: Session, apiKeys?: string | ApiKeys): Promise<Design | undefined> {
  const summary = session.interview.summary.trim();
  const confirmedAnswers = session.interview.rounds.flatMap(round => round.questions.map(question => ({ question: question.question, answer: round.answers[question.id] })));
  const compactAnswers = summary && JSON.stringify(confirmedAnswers).length <= 4000 ? { confirmedAnswers } : {};
  const requirements = { brief: session.description, requirements: summary, ...(!summary ? { confirmedAnswers } : {}), dbms: session.choice?.selected };
  if (!session.designDraft) {
    const plan = await callModel(session, "design", designPlanSchema, {
      brief: session.description,
      requirements: summary,
      phase: "plan",
      candidateEntities: session.intake?.entities,
      ...(!summary ? { confirmedAnswers } : compactAnswers),
      dbms: session.choice?.selected,
    }, apiKeys, validatePlan, { prompt: "design-plan", label: "design plan" });
    session.designDraft = { plan, tables: [] };
    return;
  }
  const draft = session.designDraft;
  const parentContext = (target: DesignPlan["tables"][number], previous: typeof draft.tables) => previous.filter(table => target.dependsOn.includes(table.name)).map(table => {
    const unique = [...table.unique, ...table.indexes.filter(index => index.unique).map(index => index.columns)];
    const keyColumns = new Set([...table.primaryKey, ...unique.flat()]);
    return {
      name: table.name,
      primaryKey: table.primaryKey,
      unique,
      columns: table.columns.filter(column => keyColumns.has(column.name)),
      rows: table.rows.map(row => Object.fromEntries(Object.entries(row).filter(([name]) => keyColumns.has(name)))),
    };
  });
  const buildTable = async (target: DesignPlan["tables"][number], previous: typeof draft.tables) => {
    const result = await callModel(session, "design", z.object({ table: designSchema.shape.tables.element }), {
      ...requirements,
      phase: "table",
      plan: { businessRules: draft.plan.businessRules, security: draft.plan.security, assumptions: draft.plan.assumptions },
      target,
      parents: parentContext(target, previous),
      reservedNames: previous.flatMap(table => [...table.indexes, ...table.checks].map(item => item.name)),
    }, apiKeys, candidate => {
      if (candidate.table.name !== target.name) throw new AppError("Return only the requested table: " + target.name + ".");
      if (candidate.table.foreignKeys.some(key => key.refTable !== target.name && !target.dependsOn.includes(key.refTable))) throw new AppError("Foreign keys may only reference this table or its declared dependencies. Use the supplied parent keys and rows exactly.");
      validateDesign(designSchema.parse({ ...draft.plan, tables: [...previous, candidate.table] }));
    }, { prompt: "design-table", label: "design table " + target.name });
    return result.table;
  };
  let tables = [...draft.tables];
  while (tables.length < draft.plan.tables.length) {
    const built = new Set(tables.map(table => table.name));
    const wave = draft.plan.tables.filter(table => !built.has(table.name) && table.dependsOn.every(parent => built.has(parent))).slice(0, concurrency());
    if (!wave.length) throw new AppError("The saved design plan cannot be completed: its dependency order is circular. Delete the draft and regenerate the plan.", 409);
    const settled = await Promise.allSettled(wave.map(target => buildTable(target, tables)));
    const builtTables = settled.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    const failure = settled.find(result => result.status === "rejected");
    const byName = new Map([...tables, ...builtTables].map(table => [table.name, table]));
    tables = draft.plan.tables.flatMap(planned => byName.get(planned.name) ?? []);
    if (failure) {
      session.designDraft = { plan: draft.plan, tables };
      throw failure.reason;
    }
  }
  const design = designSchema.parse({ ...draft.plan, tables });
  validateDesign(design);
  return design;
}
