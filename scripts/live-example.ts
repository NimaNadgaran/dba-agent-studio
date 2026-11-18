import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { presetConfig } from "../src/lib/provider-catalog";
import { callModel } from "../src/lib/provider";
import { newSession, transition, type WorkflowAction } from "../src/lib/workflow";
import { saveProviderCheck, saveSession } from "../src/lib/store";
import type { Session } from "../src/lib/types";

const brief = "Design a database for a small equipment-lending club, operated by one librarian on a single offline workstation. Use three entities: members (id, full_name, unique email), items (id, unique asset_tag, name), and loans (id, member_id, item_id, borrowed_on, nullable returned_on). A member and an item each have many historical loans; every loan has one member and one item. No payments, bookings, authentication tables or locations. Store UTC dates. Keep loan history and RESTRICT deletion of referenced members/items. Require returned_on >= borrowed_on when present. Use SQLite. Seed at least three realistic rows per table with returned and open loans. The app, not a SQL CHECK, ensures at most one open loan per item. A library clerk is the only trusted user; protect the local file using OS permissions and backups. This is a wholly synthetic public test, not the course scenario.md.";
const answers = "Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.";

async function main() {
  const config = presetConfig(process.env.LIVE_PROVIDER || "kilo");
  if (process.env.LIVE_MODEL) config.model = process.env.LIVE_MODEL;
  if (process.env.LIVE_BASE_URL) config.baseUrl = process.env.LIVE_BASE_URL;
  if (config.provider === "demo") throw new Error("Live checks cannot use the offline fixture.");
  const reviewExample = process.argv.includes("--review-example");
  const refreshExample = process.argv.includes("--refresh-example");
  const fromExisting = reviewExample || refreshExample;
  const session: Session = fromExisting ? JSON.parse(await fs.readFile(path.join(process.cwd(), "examples", "equipment-club-live", "session.json"), "utf8")) : newSession(brief, config);
  process.stdout.write(`Live synthetic test: ${session.id}\nEndpoint: ${config.baseUrl}\nRequested model: ${config.model}\n`);
  if (!fromExisting) {
    try { await callModel(session, "connection", z.object({ ok: z.literal(true) }), { instruction: "Return exactly {\"ok\":true}." }); }
    finally { if (session.logs.length) await saveProviderCheck(session.logs); }
    process.stdout.write(`Connection verified. Resolved model: ${session.logs.at(-1)?.resolvedModel || config.model}\n`);
  }
  if (process.argv.includes("--probe")) return;

  const step = async (action: WorkflowAction) => {
    process.stdout.write(`Running ${action.action}…\n`);
    let parts = 0;
    do {
      try { await transition(session, action); }
      finally { await saveSession(session); }
      parts += 1;
      if (parts >= 31 && action.action === "design" && !session.design) throw new Error("Design exceeded the part safety limit; saved progress can be resumed.");
    } while (action.action === "design" && !session.design);
    process.stdout.write(`Saved ${action.action}; ${session.logs.length} logged attempts.\n`);
  };
  if (!fromExisting) {
    await step({ action: "intake" });
    for (let round = 0; round < 4 && !session.interview.ready; round++) await step({ action: "interview", answers: Object.fromEntries(session.interview.pending.map(question => [question.id, answers])) });
    assert.equal(session.interview.ready, true, "Interview did not finish within four synthetic answer rounds.");
    await step({ action: "selection" });
    assert.equal(session.choice?.selected, "SQLite", "Model did not honor the explicitly requested SQLite deployment.");
    await step({ action: "design" });
  }
  assert.equal(session.design?.tables.length, 3, "Unexpected invented or missing entities.");
  if (!refreshExample) await step({ action: "revision", request: reviewExample ? "Correct two review findings. The original brief explicitly requested date-only borrowed_on and returned_on: change both to abstract date, with YYYY-MM-DD seed values, not timestamps. Correct the contradictory email assumption: the database enforces email uniqueness through UNIQUE, while email format validation belongs to the application. Preserve all three entities, keys, constraints, loan history, optional phone string length 30, populated and NULL phone samples, and SQLite. Document these review corrections." : "Add an optional phone string to members, length 30. Include populated and NULL phone sample values, update privacy and normalization notes, and preserve all other requirements and SQLite." });
  const member = session.design!.tables.find(table => table.name === "members");
  assert.ok(member, "Members table was lost.");
  assert.ok(member.columns.some(column => column.name === "phone" && column.nullable), "Requested optional member phone was lost.");
  assert.ok(member.rows.some(row => row.phone === null));
  assert.ok(member.rows.some(row => typeof row.phone === "string"));
  assert.ok(session.artifacts["requirements.md"].content.includes("optional phone"));
  if (reviewExample) assert.ok(session.design!.tables.find(table => table.name === "loans")!.columns.filter(column => ["borrowed_on", "returned_on"].includes(column.name)).every(column => column.type === "date"));
  if (refreshExample) {
    const { writeDesign, writeRequirements } = await import("../src/lib/artifacts");
    writeRequirements(session); writeDesign(session);
  }
  if (!session.approvedAt) await step({ action: "approve" });
  await step({ action: "sql" });
  if (!session.approvedAt) { await step({ action: "approve" }); await step({ action: "sql" }); }
  assert.equal(session.validation?.status, "passed", JSON.stringify(session.validation));
  assert.ok(session.artifacts["schema.sql"] && session.artifacts["seed.sql"]);
  assert.ok(session.logs.every(log => log.provider !== "offline-fixture"));
  const directory = path.join(process.cwd(), "examples", "equipment-club-live");
  await fs.mkdir(directory, { recursive: true });
  for (const item of Object.values(session.artifacts)) await fs.writeFile(path.join(directory, item.name), item.content, "utf8");
  await fs.writeFile(path.join(directory, "llm-calls.json"), JSON.stringify(session.logs, null, 2), "utf8");
  await fs.writeFile(path.join(directory, "session.json"), JSON.stringify(session, null, 2), "utf8");
  process.stdout.write(`${refreshExample ? "PASS: recompiled the existing real-model example without new model calls; actual SQLite execution passed." : "PASS: real model, adaptive interview, three-table design, phone revision, approval and actual SQLite execution."}\nExample: ${directory}\n`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
