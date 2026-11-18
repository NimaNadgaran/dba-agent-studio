import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { demoAnswers, draftInterviewAnswers, newSession, transition } from "../src/lib/workflow";
import { listSessions, readSession, saveProviderCheck, saveSession, validId, withSessionLock } from "../src/lib/store";
import type { Session } from "../src/lib/types";

const demoConfig = { provider: "demo" as const, model: "", baseUrl: "" };
async function toDesign(): Promise<Session> {
  const session = newSession("", demoConfig);
  await transition(session, { action: "intake" });
  await transition(session, { action: "interview", answers: demoAnswers });
  await transition(session, { action: "interview", answers: demoAnswers });
  await transition(session, { action: "selection" });
  await transition(session, { action: "design" });
  return session;
}

test("ordered workflow rejects skipped stages and premature SQL", async () => {
  const session = newSession("", demoConfig);
  await assert.rejects(() => transition(session, { action: "selection" }), /Finish the interview/);
  await assert.rejects(() => transition(session, { action: "sql" }), /Explicitly approve/);
  await transition(session, { action: "intake" });
  assert.equal(session.interview.pending.length, 7);
  await assert.rejects(() => transition(session, { action: "interview", answers: {} }), /Please answer/);
  await transition(session, { action: "interview", answers: demoAnswers });
  assert.equal(session.interview.ready, false);
  assert.equal(session.interview.pending.length, 2);
  assert.ok(session.interview.pending[0].question.includes("You require"));
  await assert.rejects(() => transition(session, { action: "selection" }), /Finish the interview/);
  await transition(session, { action: "interview", answers: demoAnswers });
  assert.equal(session.interview.ready, true);
  assert.equal(session.interview.rounds.length, 2);
});

test("revisions propagate to every artifact and invalidate approval and old SQL", async () => {
  const session = await toDesign();
  await transition(session, { action: "revision", request: "Switch to SQLite" });
  await transition(session, { action: "approve" });
  await transition(session, { action: "sql" });
  assert.equal(session.validation?.status, "passed");
  assert.ok(session.completedStages.includes(6));
  assert.ok(session.artifacts["schema.sql"]);
  await transition(session, { action: "revision", request: "Add an optional phone number to members" });
  assert.equal(session.approvedAt, undefined);
  assert.equal(session.artifacts["schema.sql"], undefined);
  assert.equal(session.artifacts["seed.sql"], undefined);
  assert.equal(session.validation, undefined);
  assert.equal(session.stage, 5);
  for (const name of ["conceptual-model.md", "logical-schema.md", "normalization.md", "design.json"]) assert.ok(session.artifacts[name].content.includes("phone"), name);
  assert.ok(session.artifacts["changelog.md"].content.includes("phone number"));
  assert.ok(session.artifacts["requirements.md"].content.includes("Add an optional phone number to members"));
  assert.ok(session.changes.at(-1)!.files.includes("requirements.md"));
  await assert.rejects(() => transition(session, { action: "sql" }), /Explicitly approve/);
  await transition(session, { action: "approve" });
  await transition(session, { action: "sql" });
  assert.equal((session as Session).validation?.status, "passed");
  assert.ok((session as Session).artifacts["schema.sql"].content.includes("phone"));
});

test("unsupported fixture revisions fail transparently and provenance cannot change", async () => {
  const session = await toDesign();
  await assert.rejects(() => transition(session, { action: "revision", request: "Build an entirely new hospital management system" }), /Offline example revisions support/);
  await assert.rejects(() => transition(session, { action: "config", config: { provider: "compatible", model: "a-model", baseUrl: "https://api.example.org/v1" } }), /preserves provenance/);
  assert.ok(session.logs.every(log => log.provider === "offline-fixture"));
  await assert.rejects(() => transition(session, { action: "config", agentConfigs: {} }), /live workspace/);
});

test("sessions resume from disk, output directory contains complete artifacts, stale SQL removed", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "dba-agent-test-"));
  process.env.DATA_DIR = path.join(temporary, "data"); process.env.OUTPUT_DIR = path.join(temporary, "outputs");
  const session = await toDesign();
  await transition(session, { action: "revision", request: "Switch to SQLite" }); await transition(session, { action: "approve" }); await transition(session, { action: "sql" });
  await saveSession(session);
  const restored = await readSession(session.id);
  assert.equal(restored.designVersion, session.designVersion); assert.equal(restored.stage, 6);
  assert.ok((await listSessions()).some(item => item.id === session.id));
  assert.equal(await readFile(path.join(temporary, "outputs", session.id, "seed.sql"), "utf8"), session.artifacts["seed.sql"].content);
  const diagnosticId = await saveProviderCheck(session.logs.slice(0, 1));
  const diagnostic = JSON.parse(await readFile(path.join(temporary, "data", "provider-checks", `${diagnosticId}.json`), "utf8"));
  assert.equal(diagnostic.logs.length, 1);
  assert.ok(!(await listSessions()).some(item => item.id === diagnosticId));
  await transition(restored, { action: "revision", request: "Add an optional phone number to members" }); await saveSession(restored);
  assert.ok(!(await readdir(path.join(temporary, "outputs", session.id))).includes("schema.sql"));
  assert.ok(!validId("../../secrets"));
  await assert.rejects(() => readSession("../secrets"), /Invalid workspace ID/);
});

test("per-session operations serialize without leaking locks", async () => {
  const seen: string[] = [];
  await Promise.all([
    withSessionLock("test", async () => { seen.push("first:start"); await new Promise(resolve => setTimeout(resolve, 20)); seen.push("first:end"); }),
    withSessionLock("test", async () => { seen.push("second:start"); seen.push("second:end"); }),
  ]);
  assert.deepEqual(seen, ["first:start", "first:end", "second:start", "second:end"]);
});


test("offline automatic answers preserve edits and cannot submit or skip interview rounds", async () => {
  const session = newSession("", demoConfig);
  await assert.rejects(() => draftInterviewAnswers(session), /Complete intake first/);
  await transition(session, { action: "intake" });
  const question = session.interview.pending[0];
  const answers = await draftInterviewAnswers(session, { [question.id]: "My manually reviewed answer." });
  assert.equal(answers[question.id], "My manually reviewed answer.");
  assert.equal(Object.keys(answers).length, 7); assert.equal(session.interview.rounds.length, 0);
  assert.equal(session.stage, 2); assert.equal(session.interview.ready, false);
  await transition(session, { action: "interview", answers });
  assert.equal(session.interview.ready, false); assert.equal(session.interview.pending.length, 2);
  const followups = await draftInterviewAnswers(session);
  await transition(session, { action: "interview", answers: followups });
  assert.equal(session.stage, 3); assert.equal(session.interview.ready, true);
  await assert.rejects(() => draftInterviewAnswers(session), /unfinished interview/);
});

test("saved workspaces expose legacy design documents as text without regenerating the model", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "dba-agent-text-test-"));
  const previous = { data: process.env.DATA_DIR, output: process.env.OUTPUT_DIR };
  try {
    process.env.DATA_DIR = path.join(temporary, "data"); process.env.OUTPUT_DIR = path.join(temporary, "outputs");
    const session = await toDesign();
    session.artifacts["conceptual-model.md"].content = "```mermaid\nerDiagram\n```";
    await saveSession(session);
    const restored = await readSession(session.id);
    assert.match(restored.artifacts["conceptual-model.md"].content, /This text explains the entity-relationship diagram/);
    assert.doesNotMatch(restored.artifacts["conceptual-model.md"].content, /```|erDiagram/);
    assert.deepEqual(restored.design, session.design);
    assert.equal(restored.logs.length, session.logs.length);
    assert.equal(restored.version, session.version);
    assert.equal(restored.designVersion, session.designVersion);
    assert.equal(restored.artifacts["conceptual-model.md"].updatedAt, session.artifacts["conceptual-model.md"].updatedAt);
    await saveSession(restored);
    assert.equal(await readFile(path.join(temporary, "outputs", restored.id, "conceptual-model.md"), "utf8"), restored.artifacts["conceptual-model.md"].content);
  } finally {
    if (previous.data === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previous.data;
    if (previous.output === undefined) delete process.env.OUTPUT_DIR; else process.env.OUTPUT_DIR = previous.output;
  }
});
